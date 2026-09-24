"use client";
import { useMemo, useState } from "react";

type Row = { type: string; cls: string; n: number; nt: string; in_syn: number; out_syn: number };

export default function TypeTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => r.type.toLowerCase().includes(s) || r.cls.toLowerCase().includes(s)) : rows;
  }, [q, rows]);
  return (
    <>
      <input className="search" placeholder={`Search ${rows.length} cell types`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cell types" />
      <div className="table-scroll" style={{ marginTop: 12 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Cell type</th>
              <th>Class</th>
              <th>Transmitter</th>
              <th className="num">Neurons</th>
              <th className="num">Synapses in</th>
              <th className="num">Synapses out</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.type}>
                <td className="mono">{r.type}</td>
                <td className="muted">{r.cls.replace("_", " ")}</td>
                <td className="muted">{r.nt}</td>
                <td className="num">{r.n.toLocaleString("en-US")}</td>
                <td className="num">{r.in_syn.toLocaleString("en-US")}</td>
                <td className="num">{r.out_syn.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="muted small">No cell type matches “{q}”.</p>}
      </div>
    </>
  );
}
