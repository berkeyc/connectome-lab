"use client";
// Frame by frame rendering of an experiment for its preview clip. The brain,
// the world and the 3D scene all advance by exactly one video frame per call
// of window.__frame(), so a slow machine still produces a smooth clip. Used by
// scripts that capture thumbnails; not linked from the site.
import { useEffect, useRef } from "react";
import { Brain } from "@/lib/engine/brain";
import type { Graph, SpeciesMeta } from "@/lib/engine/types";
import { getExperiment } from "@/lib/experiments/catalog";
import { BrainTick, Smoother } from "@/lib/experiments/loop";

declare global {
  interface Window {
    __ready?: boolean;
    __frame?: (n?: number) => void;
    __warm?: (ms: number) => void;
  }
}

export default function RenderStage({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const def = getExperiment(id);
      const c = ref.current;
      if (!def?.createWorld || !def.scene3d || !c) return;
      const [{ createScene }, lib, graph] = await Promise.all([
        import("@/lib/three/scenes"),
        fetch("/data/library.json").then((r) => r.json() as Promise<SpeciesMeta[]>),
        fetch(`/data/species/${def.species}/graph.json`).then((r) => r.json() as Promise<Graph>),
      ]);
      if (!alive) return;
      const meta0 = lib.find((m) => m.id === def.species)!;
      const meta = def.dtMs ? { ...meta0, sim: { ...meta0.sim, dt_ms: def.dtMs } } : meta0;
      const brain = new Brain(graph, meta, { brain: "real", seed: 2 });
      const tick = new BrainTick(brain, def.channels);
      const smooth = new Smoother(def.smoothMs ?? 100);
      const world = def.createWorld(2);
      const scene = createScene(def.scene3d, c);
      scene.setCamera("chase");
      scene.resize(c.clientWidth, c.clientHeight);
      const FRAME = 1000 / 24;
      let acc = 0;
      const stepSim = (ms: number) => {
        acc += ms;
        while (acc >= 20) {
          acc -= 20;
          const { rates } = tick.run(world.sense(), 20);
          world.act(smooth.update(rates, 20), 20);
        }
      };
      window.__warm = (ms: number) => stepSim(ms);
      window.__frame = (n = 1) => {
        for (let k = 0; k < n; k++) {
          stepSim(FRAME);
          const snap = world.snapshot?.();
          if (snap) scene.update(snap, FRAME);
        }
        scene.render();
      };
      // render idle frames while the fly model and textures load
      const idle = () => {
        if (!alive || window.__ready === undefined) return;
        const snap = world.snapshot?.();
        if (snap) scene.update(snap, 16);
        scene.render();
      };
      window.__ready = false;
      const t = setInterval(idle, 100);
      setTimeout(() => {
        clearInterval(t);
        window.__ready = true;
      }, 6000);
    })();
    return () => {
      alive = false;
    };
  }, [id]);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", display: "block", zIndex: 2147483000 }} />;
}
