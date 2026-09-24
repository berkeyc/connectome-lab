// Class to class synapse flow as an SVG heatmap (server rendered).
export default function FlowMatrix({ classes, matrix }: { classes: string[]; matrix: number[][] }) {
  const n = classes.length;
  const cell = 46;
  const left = 118;
  const top = 108;
  const max = Math.max(1, ...matrix.flat());
  const rowTotals = matrix.map((r) => r.reduce((a, b) => a + b, 0) || 1);
  const label = (c: string) => c.replace("_", " ");
  return (
    <svg viewBox={`0 0 ${left + n * cell + 4} ${top + n * cell + 4}`} style={{ width: "100%", maxWidth: (left + n * cell + 4) * 1.15, height: "auto", display: "block", margin: "0 auto" }} role="img" aria-label="Synapse flow between neuron classes">
      {classes.map((c, j) => (
        <text key={`c${j}`} x={left + j * cell + cell / 2} y={top - 10} fontSize="11.5" fill="var(--text-2)" textAnchor="start" transform={`rotate(-40 ${left + j * cell + cell / 2} ${top - 10})`}>
          {label(c)}
        </text>
      ))}
      {classes.map((c, i) => (
        <text key={`r${i}`} x={left - 10} y={top + i * cell + cell / 2 + 4} fontSize="11.5" fill="var(--text-2)" textAnchor="end">
          {label(c)}
        </text>
      ))}
      {matrix.map((row, i) =>
        row.map((v, j) => {
          const a = v ? 0.12 + 0.88 * (Math.log(v + 1) / Math.log(max + 1)) : 0;
          const share = (100 * v) / rowTotals[i];
          return (
            <g key={`${i}-${j}`}>
              <rect x={left + j * cell + 1} y={top + i * cell + 1} width={cell - 2} height={cell - 2} rx="6" fill={v ? "var(--accent)" : "var(--surface-2)"} fillOpacity={v ? a : 1}>
                <title>{`${label(classes[i])} → ${label(classes[j])}: ${v.toLocaleString("en-US")} synapses (${share.toFixed(1)}% of output)`}</title>
              </rect>
              {share >= 1 && (
                <text x={left + j * cell + cell / 2} y={top + i * cell + cell / 2 + 4} fontSize="11" textAnchor="middle" fill={a > 0.55 ? "#fff" : "var(--text)"} style={{ fontFamily: "var(--mono)" }}>
                  {share.toFixed(0)}%
                </text>
              )}
            </g>
          );
        }),
      )}
      <text x={4} y={top - 10} fontSize="10.5" fill="var(--text-3)">from ↓ to →</text>
    </svg>
  );
}
