// Canvas drawing for spike rasters (spiking model) and activity heatmaps.
import type { Graph, SimResult } from "./engine/types";

export const CLASS_ORDER = ["sensory", "optic", "visual_projection", "interneuron", "central", "descending", "ascending", "motor", "other"];

/** Row order: neurons grouped by class (sensory at the top, motor at the bottom), then by type. */
export function neuronOrder(g: Graph): { row: Int32Array; bands: { cls: string; from: number; to: number }[] } {
  const rank = (c: string) => {
    const r = CLASS_ORDER.indexOf(c);
    return r < 0 ? CLASS_ORDER.length : r;
  };
  const idx = g.type.map((_, i) => i);
  idx.sort((a, b) => rank(g.classes[g.cls[a]]) - rank(g.classes[g.cls[b]]) || g.type[a] - g.type[b] || a - b);
  const row = new Int32Array(g.type.length);
  idx.forEach((neuron, r) => (row[neuron] = r));
  const bands: { cls: string; from: number; to: number }[] = [];
  idx.forEach((neuron, r) => {
    const cls = g.classes[g.cls[neuron]];
    const last = bands[bands.length - 1];
    if (last && last.cls === cls) last.to = r;
    else bands.push({ cls, from: r, to: r });
  });
  return { row, bands };
}

function cssVar(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || "#888";
}

export function drawRaster(
  canvas: HTMLCanvasElement,
  g: Graph,
  res: Pick<SimResult, "raster" | "durationMs" | "neurons"> & { trace?: { dtMs: number; frames: number; data: Float32Array } | null },
  order: ReturnType<typeof neuronOrder>,
  opts: { upToMs?: number; highlight?: Set<number>; lesioned?: Set<number> } = {},
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const accent = cssVar(canvas, "--accent");
  const warn = cssVar(canvas, "--warn");
  const faint = cssVar(canvas, "--line");
  const text3 = cssVar(canvas, "--text-3");
  const left = 92;
  const plotW = w - left - 8;
  const n = res.neurons;
  const rowH = h / n;
  const upTo = opts.upToMs ?? res.durationMs;

  // class bands
  ctx.font = "11px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  order.bands.forEach((b, k) => {
    const y0 = b.from * rowH;
    const y1 = (b.to + 1) * rowH;
    if (k % 2 === 1) {
      ctx.fillStyle = faint;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(left, y0, plotW, y1 - y0);
      ctx.globalAlpha = 1;
    }
    if (y1 - y0 > 12) {
      ctx.fillStyle = text3;
      ctx.fillText(b.cls === "visual_projection" ? "visual proj." : b.cls, 6, (y0 + y1) / 2);
    }
  });

  // lesioned rows
  if (opts.lesioned?.size) {
    ctx.fillStyle = warn;
    ctx.globalAlpha = 0.18;
    for (const i of opts.lesioned) ctx.fillRect(left, order.row[i] * rowH, plotW, Math.max(rowH, 1));
    ctx.globalAlpha = 1;
  }

  if (res.trace) {
    // graded activity heatmap
    const { frames, data, dtMs } = res.trace;
    const cw = plotW / frames;
    const shown = Math.min(frames, Math.floor(upTo / dtMs));
    ctx.fillStyle = accent;
    for (let f = 0; f < shown; f++) {
      for (let i = 0; i < n; i++) {
        const a = data[f * n + i];
        if (a < 0.02) continue;
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillRect(left + f * cw, order.row[i] * rowH, Math.ceil(cw), Math.max(rowH, 1));
      }
    }
    ctx.globalAlpha = 1;
  } else {
    const dotH = Math.max(1, Math.min(3, rowH));
    for (let k = 0; k < res.raster.t.length; k++) {
      const t = res.raster.t[k];
      if (t > upTo) continue;
      const i = res.raster.i[k];
      ctx.fillStyle = opts.highlight?.has(i) ? warn : accent;
      ctx.globalAlpha = opts.highlight?.has(i) ? 0.95 : 0.75;
      ctx.fillRect(left + (t / res.durationMs) * plotW, order.row[i] * rowH, 1.4, dotH);
    }
    ctx.globalAlpha = 1;
  }

  // time axis cursor
  if (upTo < res.durationMs) {
    ctx.strokeStyle = text3;
    ctx.globalAlpha = 0.6;
    const x = left + (upTo / res.durationMs) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
