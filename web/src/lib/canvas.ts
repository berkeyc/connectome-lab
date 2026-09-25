// Canvas helpers shared by the experiment player and the training lab.
import type { Theme } from "./experiments/types";

export function readTheme(el: Element): Theme {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim() || "#888";
  return { bg: v("--surface-2"), surface: v("--surface"), line: v("--line-strong"), text: v("--text"), text2: v("--text-3"), accent: v("--accent"), warn: v("--warn"), inhib: v("--inhib") };
}

export function fitCanvas(c: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
