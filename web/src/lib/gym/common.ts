// Shared pieces of the Fly Gym: the circuit every task runs on, the neurons the
// trained readouts listen to, how senses map onto real sensory neurons, and a
// top down drawing of any gym scene for the 2D view.

import type { Target } from "../engine/types";
import { drawFly } from "../experiments/fly";
import type { Metric, Theme } from "../experiments/types";
import type { GymProp, GymSnap } from "../three/snap";
import type { Feature } from "../training/types";

/** One FlyWire circuit for every gym task: taste, smell, vision and self motion to the descending neurons and MN9. */
export const GYM_SPECIES = "fly-gym-circuit";

/** Descending neurons (both sides) and the proboscis motor neuron MN9. */
export const GYM_OUTPUT_TYPES = ["DNa01", "DNa02", "DNa03", "DNb05", "DNa11", "DNp01", "MDN", "DNp09", "DNg13", "DNp03"];
export const GYM_FEATURES: Feature[] = [
  ...GYM_OUTPUT_TYPES.flatMap((t) =>
    (["left", "right"] as const).map((side) => ({ id: `${t}_${side[0].toUpperCase()}`, label: `${t} ${side}`, targets: [{ cell_type: t, side }] as Target[] })),
  ),
  { id: "MN9", label: "MN9 (proboscis)", targets: [{ cell_type: "CB0701" }] },
];

/** Sensory neuron groups of the gym circuit, by what they sense in real flies. */
export const SENSE = {
  sugar: [{ cell_type: "LB3" }, { cell_type: "LB2d" }] as Target[],
  bitter: [{ cell_type: "LB1a,LB1d" }, { cell_type: "LB1b" }, { cell_type: "LB1c" }, { cell_type: "LB1e" }] as Target[],
  /** odour A: ORN DM1 (fruity esters, attractive) */
  odourA: [{ cell_type: "ORN_DM1" }] as Target[],
  /** odour B: ORN DA2 (geosmin, the smell of mould, aversive) */
  odourB: [{ cell_type: "ORN_DA2" }] as Target[],
  hs: (side: "left" | "right") => [{ cell_type: "HSE", side }, { cell_type: "HSN", side }, { cell_type: "HSS", side }] as Target[],
  lplc1: (side: "left" | "right") => [{ cell_type: "LPLC1", side }] as Target[],
  lc4: (side: "left" | "right") => [{ cell_type: "LC4", side }] as Target[],
  lplc2: (side?: "left" | "right") => [{ cell_type: "LPLC2", ...(side ? { side } : {}) }] as Target[],
  lc16: [{ cell_type: "LC16" }] as Target[],
};

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const metric = (label: string, value: string): Metric => ({ label, value });

/* ------------------------------------------------------------------ */
/* Top down drawing                                                     */
/* ------------------------------------------------------------------ */

function propColor(p: GymProp, t: Theme) {
  return p.color ?? t.text2;
}

/** Draws a gym snapshot from above: props, then the fly. */
export function drawGym(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme, s: GymSnap) {
  const [x0, z0, x1, z1] = s.bounds;
  const k = Math.min(w / (x1 - x0), h / (z1 - z0)) * 0.92;
  const ox = w / 2 - ((x0 + x1) / 2) * k, oz = h / 2 - ((z0 + z1) / 2) * k;
  const X = (x: number) => ox + x * k, Z = (z: number) => oz + z * k;
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, w, h);
  // floor grid
  ctx.strokeStyle = t.line;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  for (let x = Math.ceil(x0); x <= x1; x++) {
    ctx.beginPath();
    ctx.moveTo(X(x), Z(z0));
    ctx.lineTo(X(x), Z(z1));
    ctx.stroke();
  }
  for (let z = Math.ceil(z0); z <= z1; z++) {
    ctx.beginPath();
    ctx.moveTo(X(x0), Z(z));
    ctx.lineTo(X(x1), Z(z));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (s.drum) {
    // stripes of the drum around the edge
    const cx = X((x0 + x1) / 2), cz = Z((z0 + z1) / 2), r = Math.min(w, h) * 0.46;
    for (let i = 0; i < 24; i++) {
      const a = s.drum.phase + (i / 24) * Math.PI * 2;
      ctx.strokeStyle = i % 2 ? t.text : t.line;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cz, r, a, a + Math.PI / 12);
      ctx.stroke();
    }
  }
  for (const p of s.props) {
    ctx.save();
    ctx.globalAlpha = p.opacity ?? 1;
    ctx.translate(X(p.x), Z(p.z));
    ctx.rotate(p.rot ?? 0);
    ctx.fillStyle = propColor(p, t);
    const sx = (p.sx ?? 0.5) * k, sz = (p.sz ?? p.sx ?? 0.5) * k;
    if (p.kind === "box" || p.kind === "card") {
      ctx.fillRect(-sx / 2, -sz / 2, sx, sz);
      if (p.label) {
        ctx.fillStyle = t.bg;
        ctx.font = `600 ${Math.max(10, sz * 0.5)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.label, 0, 0);
      }
    } else if (p.kind === "fly") {
      ctx.restore();
      drawFly(ctx, X(p.x), Z(p.z), p.rot ?? 0, 0.45 * k, t);
      continue;
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, sx), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  drawFly(ctx, X(s.fly.x), Z(s.fly.z), s.fly.h, 0.45 * k, t, s.fly.y * k * 0.3, performance.now() / 40);
  ctx.fillStyle = t.text2;
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(s.hud.left, 10, h - 12);
  ctx.textAlign = "right";
  ctx.fillText(s.hud.right, w - 10, 18);
  ctx.textAlign = "left";
}

/** A poker or game card seen from above. */
export const card = (id: string, x: number, z: number, label: string, faceUp: boolean, color = "#f4efe6"): GymProp => ({
  id,
  kind: "card",
  x,
  y: 0.01,
  z,
  sx: 0.7,
  sy: 0.02,
  sz: 1.0,
  label: faceUp ? label : "",
  color: faceUp ? color : "#3a5a8c",
});
