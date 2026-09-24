"use client";
// Home page demo: runs the real C. elegans connectome in the browser and plays
// back the spikes, alternating between a normal worm and one without AVA.
import { useEffect, useRef, useState } from "react";
import { simulate } from "@/lib/engine/simulate";
import { selectNeurons } from "@/lib/engine/network";
import type { Graph, SpeciesMeta } from "@/lib/engine/types";
import { drawRaster, neuronOrder } from "@/lib/raster";

export default function HeroDemo({ meta }: { meta: SpeciesMeta }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState("Loading the worm...");
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      const g: Graph = await (await fetch(`/data/species/${meta.id}/graph.json`)).json();
      if (!alive) return;
      const order = neuronOrder(g);
      const presets = meta.presets.filter((p) => p.id === "nose-touch" || p.id === "head-touch-no-ava");
      const runs = presets.map((p) => ({ p, res: simulate(g, meta, { stimulate: p.stimulate, lesion: p.lesion, brain: "real", seed: 3 }) }));
      let k = 0;
      const play = () => {
        const { p, res } = runs[k % runs.length];
        const lesioned = new Set(selectNeurons(g, p.lesion));
        const highlight = new Set(selectNeurons(g, p.stimulate));
        const dir = res.readouts.find((r) => r.id === "direction");
        setLabel(p.label);
        setValue(null);
        const start = performance.now();
        const step = (now: number) => {
          if (!alive || !canvas.current) return;
          const t = Math.min(res.durationMs, ((now - start) / 2600) * res.durationMs);
          drawRaster(canvas.current, g, res, order, { upToMs: t, highlight, lesioned });
          if (t < res.durationMs) raf = requestAnimationFrame(step);
          else {
            if (dir) setValue(`${dir.value < 0 ? "backward" : "forward"} drive ${Math.abs(dir.value).toFixed(0)} Hz`);
            timer = setTimeout(() => {
              k++;
              play();
            }, 2400);
          }
        };
        raf = requestAnimationFrame(step);
      };
      play();
    })().catch(() => setLabel("Could not load the demo"));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [meta]);

  return (
    <div className="panel hero-demo">
      <canvas ref={canvas} aria-label="Spike raster of the C. elegans connectome simulation" />
      <div className="caption">
        <span>
          <span className="pill real" style={{ marginRight: 8 }}>
            <span className="dot live" /> live
          </span>
          {label}
        </span>
        <span className="mono">{value ?? "302 neurons · 1 s"}</span>
      </div>
    </div>
  );
}
