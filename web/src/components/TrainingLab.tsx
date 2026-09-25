"use client";
// The training lab: a fixed connectome, a readout that learns, and the
// learning curve, the brain's activity and the body all visible while it trains.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LearningCurve from "@/components/LearningCurve";
import { fitCanvas, readTheme } from "@/lib/canvas";
import type { Graph, SpeciesMeta } from "@/lib/engine/types";
import { WorkerBrain, type BrainClient } from "@/lib/experiments/clients";
import { Smoother } from "@/lib/experiments/loop";
import type { Metric, Theme } from "@/lib/experiments/types";
import { DEFAULT_CEM, initCem, sample, update, type CemConfig, type CemState } from "@/lib/training/cem";
import { TRAIN_DT_MS } from "@/lib/training/episode";
import { TrainPool } from "@/lib/training/pool";
import { deleteLocalRun, loadLocalRuns, newRunId, runLabel, saveLocalRun, validateRun, type GenStat, type RunRecord } from "@/lib/training/runs";
import { taskFromSpec, type ExperimentSpec } from "@/lib/training/spec";
import { getTask } from "@/lib/training/tasks";
import { CIRCUIT_LABEL, HELD_OUT_SEED, paramCount, readout, trainSeed, type CircuitVariant, type EpisodeSpec, type TrainWorld } from "@/lib/training/types";
import { useAccount } from "@/lib/account/useAccount";

const VARIANTS: CircuitVariant[] = ["real", "degree", "random", "silenced"];
const TICK_MS = 20;

type Phase = "idle" | "loading" | "training" | "paused" | "error";

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function TrainingLab({ taskId, spec, meta }: { taskId?: string; spec?: ExperimentSpec; meta: SpeciesMeta }) {
  const task = useMemo(() => (spec ? taskFromSpec(spec) : getTask(taskId!)!), [taskId, spec]);
  const dim = paramCount(task);
  const trainMeta = useMemo<SpeciesMeta>(() => ({ ...meta, sim: { ...meta.sim, dt_ms: task.dtMs ?? TRAIN_DT_MS } }), [meta, task]);
  const account = useAccount();

  const [variant, setVariant] = useState<CircuitVariant>("real");
  const [population, setPopulation] = useState(DEFAULT_CEM.population);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GenStat[]>([]);
  const [weights, setWeights] = useState<number[]>(() => new Array(dim).fill(0));
  const [runId, setRunId] = useState(() => newRunId());
  const [saved, setSaved] = useState<RunRecord[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [episodeLabel, setEpisodeLabel] = useState("");
  const [hand, setHand] = useState<{ train: number; heldOut: number } | null>(null);
  const [workers, setWorkers] = useState(1);
  const [hasRun, setHasRun] = useState(false);

  const stage = useRef<HTMLCanvasElement>(null);
  const bars = useRef<HTMLCanvasElement>(null);
  const raster = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const poolRef = useRef<TrainPool | null>(null);
  const cemRef = useRef<{ cfg: CemConfig; state: CemState } | null>(null);
  const weightsRef = useRef<number[]>(weights);
  const historyRef = useRef<GenStat[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const loopToken = useRef(0);
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    weightsRef.current = weights;
  }, [weights]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // saved runs for this task (this browser, plus the account when signed in)
  const refreshSaved = useCallback(async () => {
    const local = loadLocalRuns().filter((r) => r.taskId === task.id);
    const remote = account.user ? await account.listRuns(task.id).catch(() => []) : [];
    const byId = new Map<string, RunRecord>();
    for (const r of [...remote, ...local]) byId.set(r.id, r);
    setSaved([...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }, [task.id, account]);
  useEffect(() => {
    // loading saved runs is a subscription to external storage
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSaved();
  }, [refreshSaved]);

  const loadGraph = useCallback(async () => {
    if (!graphRef.current) {
      const res = await fetch(`/data/species/${task.species}/graph.json`);
      if (!res.ok) throw new Error(`Could not load the ${task.species} circuit (${res.status})`);
      graphRef.current = await res.json();
    }
    return graphRef.current!;
  }, [task.species]);

  /* ---------------- training loop ---------------- */

  const stopPool = () => {
    poolRef.current?.close();
    poolRef.current = null;
  };

  const trainLoop = useCallback(
    async (token: number) => {
      const pool = poolRef.current!;
      while (loopToken.current === token && phaseRef.current === "training") {
        const c = cemRef.current!;
        const t0 = performance.now();
        const cands = sample(c.state, c.cfg);
        const gen = c.state.generation;
        const res = await pool.evaluate(cands, "train", trainSeed(task, gen));
        if (loopToken.current !== token) return;
        const next = update(c.state, c.cfg, cands, res.fitness);
        const held = await pool.evaluate([next.mean], "heldOut", HELD_OUT_SEED);
        if (loopToken.current !== token) return;
        cemRef.current = { cfg: c.cfg, state: next };
        const stat: GenStat = {
          gen: next.generation,
          best: Math.max(...res.fitness),
          mean: res.fitness.reduce((a, b) => a + b, 0) / res.fitness.length,
          heldOut: held.fitness[0],
          seconds: (performance.now() - t0) / 1000,
        };
        historyRef.current = [...historyRef.current, stat];
        setHistory(historyRef.current);
        setWeights(next.mean);
      }
    },
    [task],
  );

  const ensurePool = useCallback(async () => {
    if (poolRef.current) return poolRef.current;
    const graph = await loadGraph();
    const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 2));
    const pool = new TrainPool(n);
    await pool.init(task.id, spec, graph, trainMeta, variant, 1);
    poolRef.current = pool;
    setWorkers(n);
    if (task.handDesigned && variant !== "silenced") {
      const [tr, ho] = await Promise.all([
        pool.evaluate([task.handDesigned.weights], "train", 1),
        pool.evaluate([task.handDesigned.weights], "heldOut", HELD_OUT_SEED),
      ]);
      setHand({ train: tr.fitness[0], heldOut: ho.fitness[0] });
    }
    return pool;
  }, [loadGraph, task, spec, trainMeta, variant]);

  const start = useCallback(async () => {
    setError(null);
    setNote(null);
    try {
      if (!cemRef.current) {
        const cfg: CemConfig = { ...DEFAULT_CEM, initStd: task.initStd ?? DEFAULT_CEM.initStd, population, elites: Math.max(2, Math.round(population / 4)) };
        cemRef.current = { cfg, state: initCem(dim, cfg) };
        setHasRun(true);
      }
      setPhase("loading");
      phaseRef.current = "loading";
      await ensurePool();
      setPhase("training");
      phaseRef.current = "training";
      const token = ++loopToken.current;
      await trainLoop(token);
    } catch (e) {
      if (phaseRef.current === "idle") return; // stopped on purpose
      stopPool();
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [dim, population, ensurePool, trainLoop, task]);

  const pause = () => {
    loopToken.current++;
    setPhase("paused");
    phaseRef.current = "paused";
  };

  const reset = useCallback(() => {
    loopToken.current++;
    stopPool();
    cemRef.current = null;
    setHasRun(false);
    historyRef.current = [];
    setHistory([]);
    setWeights(new Array(dim).fill(0));
    setHand(null);
    setRunId(newRunId());
    setPhase("idle");
    phaseRef.current = "idle";
    setPlayKey((k) => k + 1);
  }, [dim]);

  // switching circuit starts a new run on that circuit
  const chooseVariant = (v: CircuitVariant) => {
    if (v === variant) return;
    reset();
    setVariant(v);
  };

  useEffect(() => () => {
    loopToken.current++;
    stopPool();
  }, []);

  /* ---------------- save, load, export ---------------- */

  const record = (): RunRecord | null => {
    const c = cemRef.current;
    if (!c) return null;
    const now = new Date().toISOString();
    return {
      v: 1,
      id: runId,
      name: `${task.title} · ${CIRCUIT_LABEL[variant]}`,
      taskId: task.id,
      variant,
      cem: c.cfg,
      state: c.state,
      history: historyRef.current,
      createdAt: saved.find((s) => s.id === runId)?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const save = async () => {
    const r = record();
    if (!r) return;
    const okLocal = saveLocalRun(r);
    let msg = okLocal ? "Saved in this browser." : "This browser does not allow saving; use Export instead.";
    if (account.user) {
      try {
        await account.saveRun(r);
        msg = "Saved to your account.";
      } catch (e) {
        msg = `Saved in this browser, but not to your account: ${e instanceof Error ? e.message : e}`;
      }
    }
    setNote(msg);
    void refreshSaved();
  };

  const resume = (r: RunRecord) => {
    reset();
    setVariant(r.variant);
    setPopulation(r.cem.population);
    cemRef.current = { cfg: r.cem, state: r.state };
    setHasRun(true);
    historyRef.current = r.history;
    setHistory(r.history);
    setWeights(r.state.mean);
    setRunId(r.id);
    setNote(`Loaded “${runLabel(r)}”. Press Train to continue from generation ${r.state.generation}.`);
  };

  const importFile = async (f: File) => {
    try {
      if (f.size > 2_000_000) throw new Error("File too large");
      const r = validateRun(JSON.parse(await f.text()));
      if (r.taskId !== task.id) throw new Error(`This run belongs to another task (${r.taskId})`);
      if (r.state.mean.length !== dim) throw new Error("This run has a different readout size");
      resume(r);
    } catch (e) {
      setNote(`Could not import: ${e instanceof Error ? e.message : e}`);
    }
  };

  const remove = async (r: RunRecord) => {
    deleteLocalRun(r.id);
    if (account.user) await account.deleteRun(r.id).catch(() => undefined);
    setCompare((c) => c.filter((x) => x !== r.id));
    void refreshSaved();
  };

  /* ---------------- live playback of the current readout ---------------- */

  useEffect(() => {
    let alive = true;
    let client: BrainClient | null = null;
    let raf = 0;
    let theme: Theme | null = null;
    const specs: { spec: EpisodeSpec; held: boolean }[] = [
      ...task.train.map((spec) => ({ spec, held: false })),
      ...task.heldOut.map((spec) => ({ spec, held: true })),
    ];
    let ep = 0;
    let world: TrainWorld = task.createWorld(specs[0].spec, HELD_OUT_SEED);
    let smooth = new Smoother(task.smoothMs);
    let rates: Record<string, number> = {};
    const action = new Array(task.actions.length).fill(0);
    const spikeBuf: { t: number; row: number }[] = [];
    let n = 1;
    let inFlight = false;
    let last = performance.now();
    let budget = 0;
    let lastUi = 0;

    const nextEpisode = () => {
      ep = (ep + 1) % specs.length;
      world = task.createWorld(specs[ep].spec, HELD_OUT_SEED);
      smooth = new Smoother(task.smoothMs);
      setEpisodeLabel(`${specs[ep].held ? "Held out" : "Training"} · ${specs[ep].spec.label}`);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEpisodeLabel(`Training · ${specs[0].spec.label}`);

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const inputs = world.sense();
        let raw: Record<string, number> = Object.fromEntries(task.features.map((f) => [f.id, 0]));
        if (client) {
          const r = await client.tick(inputs, TICK_MS);
          if (!alive) return;
          raw = r.rates;
          const now = world.timeMs;
          for (let k = 0; k < r.spikes.i.length; k += 2) spikeBuf.push({ t: now + r.spikes.t[k], row: r.spikes.i[k] / n });
          while (spikeBuf.length && spikeBuf[0].t < now - 2000) spikeBuf.shift();
        }
        rates = smooth.update(raw, TICK_MS);
        readout(task, weightsRef.current, rates, action);
        world.act(action, TICK_MS);
        if (world.timeMs >= task.episodeMs) nextEpisode();
      } finally {
        inFlight = false;
      }
    };

    const drawBars = () => {
      const c = bars.current;
      if (!c || !theme) return;
      const { ctx, w, h } = fitCanvas(c);
      ctx.clearRect(0, 0, w, h);
      const F = task.features.length;
      const rowH = h / F;
      const wts = weightsRef.current;
      const maxW = Math.max(0.5, ...wts.slice(0, F).map(Math.abs));
      ctx.font = "11px var(--font-geist-mono), ui-monospace, monospace";
      task.features.forEach((f, j) => {
        const y = j * rowH;
        const v = Math.min(1, (rates[f.id] ?? 0) / 200);
        ctx.fillStyle = theme!.text2;
        ctx.fillText(f.label, 0, y + rowH * 0.7);
        const x0 = w * 0.34, bw = w * 0.36;
        ctx.fillStyle = theme!.line;
        ctx.fillRect(x0, y + rowH * 0.3, bw, rowH * 0.4);
        ctx.fillStyle = theme!.accent;
        ctx.fillRect(x0, y + rowH * 0.3, bw * v, rowH * 0.4);
        // readout weight, diverging from the centre of the last column
        const cx = w * 0.86, half = w * 0.12;
        const ww = (wts[j] ?? 0) / maxW;
        ctx.fillStyle = ww >= 0 ? theme!.warn : theme!.inhib;
        ctx.fillRect(Math.min(cx, cx + ww * half), y + rowH * 0.25, Math.abs(ww * half), rowH * 0.5);
        ctx.fillStyle = theme!.line;
        ctx.fillRect(cx, y + 2, 1, rowH - 4);
      });
    };

    const drawRaster = () => {
      const c = raster.current;
      if (!c || !theme) return;
      const { ctx, w, h } = fitCanvas(c);
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = spikeBuf.length > 8000 ? 0.25 : 0.6;
      const now = world.timeMs;
      for (const s of spikeBuf) ctx.fillRect(w - ((now - s.t) / 2000) * w, s.row * h, 1, 1);
      ctx.globalAlpha = 1;
    };

    const frame = (t: number) => {
      if (!alive) return;
      const dt = Math.min(100, t - last);
      last = t;
      budget += dt;
      if (budget >= TICK_MS && !inFlight) {
        budget = Math.min(budget - TICK_MS, 60);
        void tick();
      }
      const c = stage.current;
      if (c) {
        theme ??= readTheme(c);
        const { ctx, w, h } = fitCanvas(c);
        world.draw(ctx, w, h, theme);
      }
      drawBars();
      drawRaster();
      if (t - lastUi > 250) {
        lastUi = t;
        setMetrics(world.metrics());
      }
      raf = requestAnimationFrame(frame);
    };

    (async () => {
      try {
        if (variant !== "silenced") {
          const graph = await loadGraph();
          if (!alive) return;
          n = graph.neuronIds.length;
          client = new WorkerBrain(graph, trainMeta, task.features.map((f) => ({ ...f })), { brain: variant, seed: 1, lesion: [] });
          await client.init();
        }
        if (!alive) return;
        raf = requestAnimationFrame(frame);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      client?.close();
    };
  }, [task, trainMeta, variant, loadGraph, playKey]);

  /* ---------------- render ---------------- */

  const last = history[history.length - 1];
  const gen0 = history[0];
  const overlays = saved.filter((s) => compare.includes(s.id)).map((s) => ({ label: runLabel(s), history: s.history }));
  const reference = hand ? [{ label: task.handDesigned!.label, value: hand.heldOut }] : [];
  const busy = phase === "training" || phase === "loading";

  return (
    <div className="train">
      <div className="train-top">
        <div className="train-stage">
          <canvas ref={stage} className="train-canvas" aria-label={`${task.title}, live`} />
          <div className="train-badges">
            <span className="chip">{episodeLabel}</span>
            <span className="chip">{CIRCUIT_LABEL[variant]}</span>
            <span className="chip">Readout from generation {last?.gen ?? 0}</span>
          </div>
          <div className="train-metrics">
            {metrics.map((m) => (
              <div key={m.label}>
                <span>{m.label}</span>
                <b>{m.value}</b>
              </div>
            ))}
          </div>
        </div>

        <aside className="train-side">
          <div className="side-block">
            <div className="side-title">Circuit</div>
            <div className="seg-list" role="radiogroup" aria-label="Circuit">
              {VARIANTS.map((v) => (
                <button key={v} role="radio" aria-checked={variant === v} className={variant === v ? "on" : ""} onClick={() => chooseVariant(v)} disabled={busy}>
                  {CIRCUIT_LABEL[v]}
                </button>
              ))}
            </div>
            <p className="hint">
              {variant === "real" && "Every measured synapse of the circuit, fixed."}
              {variant === "degree" && "Same neurons, same number of partners per neuron, partners shuffled."}
              {variant === "random" && "Same neurons and weights, wired at random."}
              {variant === "silenced" && "No signal reaches the readout. Only its constant term can learn."}
            </p>
          </div>

          <div className="side-block">
            <div className="side-title">Population per generation</div>
            <div className="seg-list row3">
              {[12, 24, 48].map((p) => (
                <button key={p} className={population === p ? "on" : ""} onClick={() => setPopulation(p)} disabled={busy || hasRun}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="train-actions">
            {phase === "training" || phase === "loading" ? (
              <button className="btn primary" onClick={pause} disabled={phase === "loading"}>
                {phase === "loading" ? "Preparing…" : "Pause"}
              </button>
            ) : (
              <button className="btn primary" onClick={() => void start()}>
                {hasRun ? "Continue training" : "Train"}
              </button>
            )}
            <button className="btn" onClick={reset} disabled={phase === "loading"}>
              Reset
            </button>
          </div>
          <div className="train-actions">
            <button className="btn small" onClick={() => void save()} disabled={!history.length || busy}>
              Save run
            </button>
            <button className="btn small" onClick={() => { const r = record(); if (r) download(`${task.id}-${variant}-gen${r.state.generation}.json`, r); }} disabled={!history.length}>
              Export
            </button>
            <label className="btn small file">
              Import
              <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
            </label>
          </div>
          {note && <p className="hint">{note}</p>}
          {error && <p className="error">{error}</p>}
          <p className="hint">
            {account.user ? `Signed in as ${account.user.email}. Saved runs sync to your account.` : "Runs are saved in this browser. Sign in to keep them across devices and share them."}
          </p>
        </aside>
      </div>

      <div className="train-grid">
        <section className="panel block">
          <div className="section-row">
            <h3>Learning curve</h3>
            <span className="small muted">
              {last ? `generation ${last.gen} · ${last.seconds.toFixed(1)} s per generation on ${workers} worker${workers > 1 ? "s" : ""}` : "press Train"}
            </span>
          </div>
          <LearningCurve history={history} overlays={overlays} reference={reference} unit={task.train[0] && "dir" in task.train[0] ? "score" : "closeness"} />
          <div className="stat-row">
            <div>
              <span>Untrained (generation 1 mean)</span>
              <b>{gen0 ? gen0.mean.toFixed(1) : "–"}</b>
            </div>
            <div>
              <span>Best on training</span>
              <b>{last ? last.best.toFixed(1) : "–"}</b>
            </div>
            <div>
              <span>Held out, current readout</span>
              <b>{last ? last.heldOut.toFixed(1) : "–"}</b>
            </div>
            {hand && (
              <div>
                <span>Hand written readout, held out</span>
                <b>{hand.heldOut.toFixed(1)}</b>
              </div>
            )}
          </div>
        </section>

        <section className="panel block">
          <div className="section-row">
            <h3>Inside the circuit</h3>
            <span className="small muted">live, current readout</span>
          </div>
          <div className="bars-head small muted">
            <span>readout neurons</span>
            <span>firing rate</span>
            <span>weight</span>
          </div>
          <canvas ref={bars} className="feature-bars" style={{ height: task.features.length * 17 }} />
          <div className="small muted" style={{ marginTop: 12 }}>
            All spikes, last 2 seconds
          </div>
          <canvas ref={raster} className="mini-raster" />
        </section>
      </div>

      <section className="panel block" style={{ marginTop: 20 }}>
        <div className="section-row">
          <h3>Saved runs</h3>
          <span className="small muted">tick runs to overlay their held out curves</span>
        </div>
        {saved.length === 0 ? (
          <p className="muted small">No saved runs yet. Train the real circuit and a control, save both, and compare their curves here.</p>
        ) : (
          <ul className="run-list">
            {saved.map((r) => (
              <li key={r.id}>
                <label>
                  <input type="checkbox" checked={compare.includes(r.id)} onChange={(e) => setCompare((c) => (e.target.checked ? [...c, r.id] : c.filter((x) => x !== r.id)))} />
                  <span>{runLabel(r)}</span>
                </label>
                <span className="faint small">{new Date(r.updatedAt).toLocaleString()}</span>
                <button className="btn small" onClick={() => resume(r)} disabled={busy}>
                  Load
                </button>
                <button className="btn small ghost" onClick={() => void remove(r)} disabled={busy}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
