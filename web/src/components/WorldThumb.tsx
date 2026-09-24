"use client";
// First frame of an experiment's world, drawn without a brain, as a preview.
import { useEffect, useRef } from "react";
import { getExperiment } from "@/lib/experiments/catalog";

export default function WorldThumb({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const def = getExperiment(id);
    const c = ref.current;
    if (!def?.createWorld || !c) return;
    const world = def.createWorld(3);
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(c);
      const v = (n: string) => cs.getPropertyValue(n).trim();
      world.draw(ctx, c.clientWidth, c.clientHeight, { bg: v("--surface-2"), surface: v("--surface"), line: v("--line-strong"), text: v("--text"), text2: v("--text-3"), accent: v("--accent"), warn: v("--warn"), inhib: v("--inhib") });
    };
    // advance the world a little without neural input so the scene looks alive
    for (let k = 0; k < 40; k++) world.act({ forward: 30, dna02R: 0, dna02L: 0 }, 20);
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [id]);
  return <canvas ref={ref} className="exp-thumb" aria-hidden="true" />;
}
