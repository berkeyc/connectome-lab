"use client";
// Experiments built and shared by users (declarative specs, reviewed before
// they appear). Only published rows are readable by others, enforced by the
// database's row level security.
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/account/client";
import { encodeSpec, validateSpec, type ExperimentSpec } from "@/lib/training/spec";

type Row = { id: string; title: string; summary: string; spec: unknown; created_at: string };

export default function UserExperiments() {
  const [rows, setRows] = useState<{ id: string; spec: ExperimentSpec; created: string }[] | null>(null);
  const [off, setOff] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      // accounts are switched off on this deployment; nothing external to subscribe to
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOff(true);
      return;
    }
    let alive = true;
    sb.from("community_experiments")
      .select("id,title,summary,spec,created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        if (!alive) return;
        const ok: { id: string; spec: ExperimentSpec; created: string }[] = [];
        for (const r of (data as Row[]) ?? []) {
          try {
            ok.push({ id: r.id, spec: validateSpec(r.spec), created: r.created_at });
          } catch {
            /* skip invalid rows */
          }
        }
        setRows(ok);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="community-group">
      <div className="section-row">
        <h3>Built by users</h3>
        <Link className="btn small primary" href="/community/new">
          Build an experiment
        </Link>
      </div>
      {off || (rows && rows.length === 0) ? (
        <div className="empty-state">
          <p>
            <b>No shared experiments yet.</b> Pick a real circuit, choose which neurons the senses excite and which neurons the
            readout reads, and train it. Share it as a link right away, or submit it here once you sign in.
          </p>
        </div>
      ) : !rows ? (
        <div className="community">
          {[0, 1, 2].map((k) => (
            <div key={k} className="community-card skeleton" style={{ height: 180 }} />
          ))}
        </div>
      ) : (
        <div className="community">
          {rows.map((r) => (
            <article key={r.id} className="community-card">
              <div className="community-by">{r.spec.species} · {r.spec.world === "track" ? "driving" : "odour search"}</div>
              <h4>{r.spec.title}</h4>
              <p>{r.spec.summary}</p>
              <div className="row" style={{ marginTop: "auto" }}>
                <Link className="btn small primary" href={`/train/custom#spec=${encodeSpec(r.spec)}`}>
                  Train it
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
