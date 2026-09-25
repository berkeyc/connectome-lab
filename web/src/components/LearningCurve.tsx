"use client";
// Learning curve: population best and mean on the training episodes, and the
// current readout on episodes it never trained on. Saved runs can be overlaid.
import type { GenStat } from "@/lib/training/runs";

type Overlay = { label: string; history: GenStat[] };

export default function LearningCurve({
  history,
  overlays = [],
  reference,
  height = 260,
  unit,
}: {
  history: GenStat[];
  overlays?: Overlay[];
  reference?: { label: string; value: number }[];
  height?: number;
  unit: string;
}) {
  const W = 640, H = height, L = 44, R = 12, T = 14, B = 30;
  const all = [
    ...history.flatMap((h) => [h.best, h.mean, h.heldOut]),
    ...overlays.flatMap((o) => o.history.map((h) => h.heldOut)),
    ...(reference ?? []).map((r) => r.value),
  ];
  const gens = Math.max(10, history.length, ...overlays.map((o) => o.history.length));
  let lo = all.length ? Math.min(...all) : 0;
  let hi = all.length ? Math.max(...all) : 1;
  if (hi - lo < 1e-6) {
    hi += 1;
    lo -= 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const x = (g: number) => L + ((g - 1) / Math.max(1, gens - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = (pts: GenStat[], key: keyof GenStat) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.gen).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);

  if (!history.length && !overlays.length)
    return (
      <div className="curve-empty">
        No generations yet. Press Train: every generation adds a point for the best candidate, the population mean and the
        held out test.
      </div>
    );
  return (
    <figure className="curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Learning curve">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="curve-grid" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="curve-tick">
              {t.toFixed(Math.abs(hi - lo) < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        <text x={W - R} y={H - 8} textAnchor="end" className="curve-tick">
          generation
        </text>
        <text x={L} y={H - 8} className="curve-tick">
          1
        </text>
        {(reference ?? []).map((r) => (
          <g key={r.label}>
            <line x1={L} x2={W - R} y1={y(r.value)} y2={y(r.value)} className="curve-ref" />
            <text x={W - R - 4} y={y(r.value) - 5} textAnchor="end" className="curve-tick">
              {r.label}
            </text>
          </g>
        ))}
        {overlays.map((o, k) => (
          <path key={k} d={path(o.history, "heldOut")} className="curve-overlay" />
        ))}
        {history.length > 0 && (
          <>
            <path d={path(history, "mean")} className="curve-mean" />
            <path d={path(history, "best")} className="curve-best" />
            <path d={path(history, "heldOut")} className="curve-held" />
            <circle cx={x(history[history.length - 1].gen)} cy={y(history[history.length - 1].heldOut)} r={4} className="curve-dot" />
          </>
        )}
      </svg>
      <figcaption className="curve-legend">
        <span>
          <i className="k-best" /> best candidate
        </span>
        <span>
          <i className="k-mean" /> population mean
        </span>
        <span>
          <i className="k-held" /> held out ({unit})
        </span>
        {overlays.length > 0 && (
          <span>
            <i className="k-overlay" /> saved runs, held out
          </span>
        )}
      </figcaption>
    </figure>
  );
}
