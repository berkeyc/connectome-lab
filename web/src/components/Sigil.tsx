// A small deterministic "connectome" glyph per species, drawn from its id.
// Replaces emoji and stock icons with something that belongs to the subject.

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export default function Sigil({ id, size = 44, muted = false }: { id: string; size?: number; muted?: boolean }) {
  const rnd = hash(id);
  const nodes = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.6;
    const r = i === 0 ? 0 : 9 + rnd() * 9;
    return { x: 22 + Math.cos(a) * r, y: 22 + Math.sin(a) * r };
  });
  const edges: [number, number][] = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push([0, i]);
    if (rnd() > 0.45) edges.push([i, 1 + Math.floor(rnd() * (nodes.length - 1))]);
  }
  const stroke = muted ? "var(--text-3)" : "var(--accent)";
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <rect x="0.5" y="0.5" width="43" height="43" rx="12" fill="var(--surface-2)" stroke="var(--line)" />
      {edges.map(([a, b], k) => (
        <line key={k} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={stroke} strokeOpacity={0.45} strokeWidth={1.2} />
      ))}
      {nodes.map((n, k) => (
        <circle key={k} cx={n.x} cy={n.y} r={k === 0 ? 3.2 : 2.2} fill={k === 0 ? stroke : "var(--surface)"} stroke={stroke} strokeWidth={1.3} />
      ))}
    </svg>
  );
}
