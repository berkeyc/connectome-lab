"use client";
// Live experiment player: the world in the middle, the brain's signals on the side.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrainVariant, Graph, SpeciesMeta } from "@/lib/engine/types";
import { getExperiment } from "@/lib/experiments/catalog";
import { LocalBrain, LOCAL_URL, WorkerBrain, type BrainClient, type ReadyInfo } from "@/lib/experiments/clients";
import { Smoother } from "@/lib/experiments/loop";
import type { Metric, Theme, World } from "@/lib/experiments/types";
import { fitCanvas, readTheme } from "@/lib/canvas";
import { CLASS_ORDER } from "@/lib/raster";

const TICK_MS = 20;
const TRACE_WINDOW_MS = 6000;
const RASTER_WINDOW_MS = 2000;

const BRAINS: { id: BrainVariant; label: string }[] = [
  { id: "real", label: "Real wiring" },
  { id: "degree", label: "Rewired, same degrees" },
  { id: "random", label: "Random wiring" },
  { id: "signs", label: "Shuffled transmitters" },
];

type Props = {
  experimentId: string;
  meta?: SpeciesMeta;
  compact?: boolean;
  autoplay?: boolean;
};

export default function ExperimentPlayer({ experimentId, meta, compact = false, autoplay = true }: Props) {
  const def = useMemo(() => getExperiment(experimentId)!, [experimentId]);
  const shown = useMemo(() => def.channels.filter((c) => !c.hidden), [def]);
  const stage = useRef<HTMLCanvasElement>(null);
  const traces = useRef<HTMLCanvasElement>(null);
  const raster = useRef<HTMLCanvasElement>(null);
  const [brainVariant, setBrainVariant] = useState<BrainVariant>("real");
  const [seed, setSeed] = useState(1);
  const [speed, setSpeed] = useState(def.speed ?? 1);
  const [running, setRunning] = useState(autoplay);
  const [source, setSource] = useState<"browser" | "local">(def.runsIn === "local" ? "local" : "browser");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "idle">("idle");
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [log, setLog] = useState<{ t: number; text: string }[]>([]);
  const [perf, setPerf] = useState({ realtime: 1, active: 0, neurons: 0 });
  const [generation, setGeneration] = useState(0);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  useEffect(() => {
    runningRef.current = running;
    speedRef.current = speed;
  }, [running, speed]);

  const restart = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    let alive = true;
    let client: BrainClient | null = null;
    let raf = 0;
    const world: World = def.createWorld!(seed);
    const smoother = new Smoother(def.smoothMs ?? 100);
    const traceBuf: Record<string, { t: number; v: number }[]> = Object.fromEntries(shown.map((c) => [c.id, []]));
    const spikes: { t: number; row: number }[] = [];
    let ready: ReadyInfo | null = null;
    let rowOf: Float32Array | null = null;
    let budget = 0;
    let inFlight = false;
    let last = performance.now();
    let theme: Theme | null = null;
    let wallAcc = 0, brainAcc = 0;
    let latestActive = 0;
    let lastUi = 0;
    let failed = false;
    // This effect owns an external system (animation loop and brain backend);
    // resetting the visible state when it restarts is intended.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLog([]);
    setMetrics(world.metrics());
    setStatus("loading");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    const buildRows = (info: ReadyInfo) => {
      const rank = (c: string) => {
        const r = CLASS_ORDER.indexOf(c);
        return r < 0 ? CLASS_ORDER.length : r;
      };
      const n = info.neurons;
      const idx = Array.from({ length: n }, (_, i) => i);
      idx.sort((a, b) => rank(info.classes[info.cls[a]]) - rank(info.classes[info.cls[b]]) || a - b);
      rowOf = new Float32Array(n);
      idx.forEach((neuron, r) => (rowOf![neuron] = r / n));
    };

    const start = async () => {
      try {
        if (source === "local") {
          client = new LocalBrain(def.localSpecies ?? def.species, def.channels, { brain: brainVariant, seed, lesion: [] });
        } else {
          if (!meta) throw new Error("This experiment only runs on the local runner.");
          const g: Graph = await (await fetch(`/data/species/${def.species}/graph.json`)).json();
          if (!alive) return;
          const m = def.dtMs ? { ...meta, sim: { ...meta.sim, dt_ms: def.dtMs } } : meta;
          client = new WorkerBrain(g, m, def.channels, { brain: brainVariant, seed, lesion: [] });
        }
        ready = await client.init();
        if (!alive) return client.close();
        buildRows(ready);
        setPerf((p) => ({ ...p, neurons: ready!.neurons }));
        if (ready.missing?.length) setLog((l) => [{ t: 0, text: `Cell types not found in this dataset: ${ready!.missing!.join(", ")}` }, ...l]);
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        failed = true;
        setStatus("error");
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    start();

    const doTick = async () => {
      if (!client || !ready || inFlight) return;
      inFlight = true;
      const inputs = world.sense();
      try {
        const res = await client.tick(inputs, TICK_MS);
        if (!alive) return;
        const smooth = smoother.update(res.rates, TICK_MS);
        world.act(smooth, TICK_MS);
        const now = world.timeMs;
        for (const c of shown) {
          const buf = traceBuf[c.id];
          buf.push({ t: now, v: res.rates[c.id] ?? 0 });
          while (buf.length && buf[0].t < now - TRACE_WINDOW_MS) buf.shift();
        }
        if (rowOf) for (let k = 0; k < res.spikes.t.length; k++) spikes.push({ t: now - TICK_MS + res.spikes.t[k], row: rowOf[res.spikes.i[k]] });
        while (spikes.length && spikes[0].t < now - RASTER_WINDOW_MS) spikes.shift();
        if (spikes.length > 20000) spikes.splice(0, spikes.length - 20000);
        latestActive = res.active;
        brainAcc += TICK_MS;
        const ev = world.drainEvents();
        if (ev.length) setLog((l) => [...ev.map((text) => ({ t: now, text })).reverse(), ...l].slice(0, 60));
      } catch (e) {
        if (alive) {
          failed = true;
          setStatus("error");
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        inFlight = false;
      }
    };

    const drawTraces = () => {
      const c = traces.current;
      if (!c || !theme) return;
      const { ctx, w, h } = fitCanvas(c);
      ctx.clearRect(0, 0, w, h);
      const rows = shown.length;
      const rh = h / rows;
      const now = world.timeMs;
      // ECG paper
      ctx.strokeStyle = theme.line;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      for (let x = w; x > 0; x -= (w / TRACE_WINDOW_MS) * 200) {
        const xx = x - ((now % 200) / TRACE_WINDOW_MS) * w;
        ctx.beginPath();
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx, h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      shown.forEach((ch, r) => {
        const y0 = r * rh;
        const buf = traceBuf[ch.id];
        const max = Math.max(50, ...buf.map((p) => p.v));
        const color = ch.tone === "warn" ? theme!.warn : ch.tone === "inhib" ? theme!.inhib : ch.tone === "text" ? theme!.text2 : theme!.accent;
        ctx.strokeStyle = theme!.line;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y0 + rh - 0.5);
        ctx.lineTo(w, y0 + rh - 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        buf.forEach((p, k) => {
          const x = w - ((now - p.t) / TRACE_WINDOW_MS) * w;
          const y = y0 + rh - 6 - (p.v / max) * (rh - 22);
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.stroke();
        const lastV = buf.length ? buf[buf.length - 1].v : 0;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(w - 3, y0 + rh - 6 - (lastV / max) * (rh - 22), 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme!.text2;
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText(ch.label, 6, y0 + 13);
        ctx.textAlign = "right";
        ctx.fillStyle = color;
        ctx.fillText(`${lastV.toFixed(0)} Hz`, w - 8, y0 + 13);
        ctx.textAlign = "left";
      });
    };

    const drawRaster = () => {
      const c = raster.current;
      if (!c || !theme) return;
      const { ctx, w, h } = fitCanvas(c);
      ctx.clearRect(0, 0, w, h);
      const now = world.timeMs;
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = 0.8;
      for (const s of spikes) ctx.fillRect(w - ((now - s.t) / RASTER_WINDOW_MS) * w, s.row * h, 1.2, Math.max(1, h / 300));
      ctx.globalAlpha = 1;
    };

    const frame = (nowWall: number) => {
      if (!alive) return;
      const dt = Math.min(100, nowWall - last);
      last = nowWall;
      if (stage.current) {
        theme ??= readTheme(stage.current);
        if (runningRef.current && !failed) {
          budget += dt * speedRef.current;
          wallAcc += dt;
          if (budget >= TICK_MS && !inFlight) {
            budget -= TICK_MS;
            budget = Math.min(budget, TICK_MS * 4); // do not accumulate a backlog
            doTick();
          }
        }
        const { ctx, w, h } = fitCanvas(stage.current);
        world.draw(ctx, w, h, theme);
        drawTraces();
        drawRaster();
        if (nowWall - lastUi > 250) {
          lastUi = nowWall;
          setMetrics(world.metrics());
          setPerf((p) => ({ ...p, realtime: wallAcc ? brainAcc / wallAcc : 1, active: latestActive }));
          wallAcc = 0;
          brainAcc = 0;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onScheme = () => (theme = null);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onScheme);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onScheme);
      client?.close();
    };
  }, [def, shown, meta, brainVariant, seed, source, generation]);

  const canBrowser = def.runsIn === "browser";

  return (
    <div className={`player ${compact ? "compact" : ""}`}>
      <div className="player-main panel">
        <div className="stage-wrap">
          <canvas ref={stage} className="stage" aria-label={`Live simulation: ${def.title}`} />
          <div className="stage-badges">
            <span className={`pill ${status === "ready" ? "real" : ""}`}>
              <span className={`dot ${status === "ready" && running ? "live" : ""}`} />
              {status === "loading" ? "loading brain" : status === "error" ? "stopped" : running ? "live" : "paused"}
            </span>
            <span className="pill mono">{source === "local" ? "local runner" : "in your browser"}</span>
            {brainVariant !== "real" && <span className="pill synthetic">{BRAINS.find((b) => b.id === brainVariant)?.label}</span>}
          </div>
          {status === "error" && (
            <div className="stage-error">
              <strong>{source === "local" ? "Local runner needed" : "Something went wrong"}</strong>
              <p>{error}</p>
              {source === "local" && (
                <p className="small">
                  Start it with <code>python local/runner.py</code>, then press restart. See “Run it locally” below.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="metric-row">
          {metrics.map((m) => (
            <div key={m.label} className="metric">
              <div className="k">{m.label}</div>
              <div className="v mono">{m.value}</div>
            </div>
          ))}
        </div>
        {!compact && (
          <div className="player-controls">
            <button className="btn small primary" onClick={() => setRunning((r) => !r)} disabled={status !== "ready"}>
              {running ? "Pause" : "Play"}
            </button>
            <button className="btn small" onClick={restart}>
              Restart
            </button>
            <select value={brainVariant} onChange={(e) => setBrainVariant(e.target.value as BrainVariant)} aria-label="Brain">
              {BRAINS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed">
              {[0.25, 0.5, 1, 2].map((s) => (
                <option key={s} value={s}>
                  {s}× speed
                </option>
              ))}
            </select>
            <label className="row small muted" style={{ gap: 6 }}>
              Seed
              <input type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <div className="segmented small-seg" role="group" aria-label="Where the brain runs">
              <button className={source === "browser" ? "on" : ""} disabled={!canBrowser} onClick={() => setSource("browser")}>
                Browser
              </button>
              <button className={source === "local" ? "on" : ""} onClick={() => setSource("local")} title={LOCAL_URL}>
                Local runner
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="player-side panel">
        <div className="side-head">
          <span className="eyebrow">Brain signals</span>
          <span className="mono small faint">
            {perf.active.toLocaleString("en-US")} / {perf.neurons.toLocaleString("en-US")} active · {perf.realtime.toFixed(2)}× real time
          </span>
        </div>
        <canvas ref={traces} className="traces" style={{ height: shown.length * (compact ? 44 : 58) }} />
        <div className="side-head">
          <span className="eyebrow">All spikes · last 2 s</span>
          <span className="small faint">sensory at top, motor at bottom</span>
        </div>
        <canvas ref={raster} className="raster" />
        {!compact && (
          <>
            <div className="side-head">
              <span className="eyebrow">Event log</span>
            </div>
            <ol className="event-log">
              {log.length === 0 && <li className="faint">Waiting for the first event…</li>}
              {log.map((e, k) => (
                <li key={`${e.t}-${k}`}>
                  <span className="mono faint">{(e.t / 1000).toFixed(1)}s</span> {e.text}
                </li>
              ))}
            </ol>
          </>
        )}
      </aside>
    </div>
  );
}
