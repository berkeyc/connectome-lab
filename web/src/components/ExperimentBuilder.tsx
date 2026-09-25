"use client";
// Build a training experiment from plain choices: a real circuit, a world,
// which neurons the senses excite and which neurons the readout reads.
// The result is a JSON spec: shareable as a link, or submitted for review.
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/account/client";
import { useAccount } from "@/lib/account/useAccount";
import type { Graph, Target } from "@/lib/engine/types";
import { encodeSpec, missingTypes, SPEC_SPECIES, validateSpec, type ExperimentSpec } from "@/lib/training/spec";

const CIRCUITS: Record<string, string> = {
  "fly-visuomotor-circuit": "Fly visuomotor circuit (FlyWire, 1,325 neurons)",
  "fly-escape-circuit": "Fly escape circuit (FlyWire, 1,067 neurons)",
  "c-elegans": "C. elegans, whole worm (302 neurons)",
};

const DEFAULTS: Record<string, Omit<ExperimentSpec, "v" | "title" | "summary" | "species">> = {
  "fly-visuomotor-circuit": {
    world: "track",
    sensors: [[{ cell_type: "LPLC1", side: "left" }], [{ cell_type: "LPLC1", side: "right" }]],
    maxHz: 160,
    features: ["DNa01", "DNa02", "DNp09", "MDN"].flatMap((t) => [{ cell_type: t, side: "left" as const }, { cell_type: t, side: "right" as const }]),
  },
  "fly-escape-circuit": {
    world: "track",
    sensors: [[{ cell_type: "LC4", side: "left" }], [{ cell_type: "LC4", side: "right" }]],
    maxHz: 120,
    features: ["DNp01", "DNp02", "DNp04", "DNp06", "DNp11"].flatMap((t) => [{ cell_type: t, side: "left" as const }, { cell_type: t, side: "right" as const }]),
  },
  "c-elegans": {
    world: "plate",
    sensors: [[{ cell_type: "AWC" }], [{ cell_type: "ASE", side: "left" }]],
    maxHz: 150,
    features: ["AIY", "AIZ", "AIB", "RIB"].flatMap((t) => [{ cell_type: t, side: "left" as const }, { cell_type: t, side: "right" as const }]),
  },
};

const label = (t: Target) => `${t.cell_type}${t.side ? ` ${t.side}` : ""}`;

function TargetList({ title, hint, value, onChange, types, max }: { title: string; hint: string; value: Target[]; onChange: (v: Target[]) => void; types: string[]; max: number }) {
  const [type, setType] = useState("");
  const [side, setSide] = useState<"" | "left" | "right" | "both">("both");
  const listId = `types-${title.replace(/\W+/g, "")}`;
  const add = () => {
    const t = type.trim();
    if (!t || !types.includes(t)) return;
    const add: Target[] = side === "both" ? [{ cell_type: t, side: "left" }, { cell_type: t, side: "right" }] : side ? [{ cell_type: t, side }] : [{ cell_type: t }];
    const next = [...value];
    for (const a of add) if (!next.some((x) => x.cell_type === a.cell_type && x.side === a.side)) next.push(a);
    onChange(next.slice(0, max));
    setType("");
  };
  return (
    <div className="builder-field">
      <label htmlFor={listId + "-in"}>{title}</label>
      <p className="hint">{hint}</p>
      <div className="chips">
        {value.map((t, k) => (
          <span key={k} className="chip stim">
            {label(t)}
            <button type="button" aria-label={`Remove ${label(t)}`} onClick={() => onChange(value.filter((_, j) => j !== k))}>
              ×
            </button>
          </span>
        ))}
        {value.length === 0 && <span className="faint small">none yet</span>}
      </div>
      <div className="builder-add">
        <input id={listId + "-in"} className="field-input" list={listId} value={type} onChange={(e) => setType(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="cell type, e.g. DNa02" maxLength={40} />
        <datalist id={listId}>
          {types.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <select className="field-input" value={side} onChange={(e) => setSide(e.target.value as typeof side)} aria-label="Side">
          <option value="both">each side separately</option>
          <option value="left">left only</option>
          <option value="right">right only</option>
          <option value="">both sides together</option>
        </select>
        <button type="button" className="btn small" onClick={add} disabled={!types.includes(type.trim()) || value.length >= max}>
          Add
        </button>
      </div>
      {type && !types.includes(type.trim()) && <p className="field-error">No cell type called “{type}” in this circuit.</p>}
    </div>
  );
}

export default function ExperimentBuilder() {
  const router = useRouter();
  const account = useAccount();
  const [species, setSpecies] = useState<string>("fly-visuomotor-circuit");
  const [spec, setSpec] = useState<ExperimentSpec>(() => ({ v: 1, title: "", summary: "", species: "fly-visuomotor-circuit", ...DEFAULTS["fly-visuomotor-circuit"] }));
  const [graph, setGraph] = useState<Graph | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "notice"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/data/species/${species}/graph.json`)
      .then((r) => r.json())
      .then((g: Graph) => alive && setGraph(g))
      .catch(() => alive && setMsg({ kind: "error", text: "Could not load the circuit." }));
    return () => {
      alive = false;
    };
  }, [species]);

  const types = useMemo(() => (graph ? graph.types.filter((t) => t !== "unknown") : []), [graph]);

  const chooseSpecies = (s: string) => {
    setGraph(null);
    setSpecies(s);
    setSpec((p) => ({ ...p, species: s, ...DEFAULTS[s] }));
  };

  const check = (): ExperimentSpec | null => {
    try {
      const v = validateSpec(spec);
      if (graph) {
        const miss = missingTypes(v, graph);
        if (miss.length) throw new Error(`Not in this circuit: ${miss.join(", ")}`);
      }
      setMsg(null);
      return v;
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : String(e) });
      return null;
    }
  };

  const tryIt = () => {
    const v = check();
    if (v) router.push(`/train/custom#spec=${encodeSpec(v)}`);
  };

  const copy = async () => {
    const v = check();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/train/custom#spec=${encodeSpec(v)}`);
      setMsg({ kind: "notice", text: "Link copied. Anyone who opens it can train your experiment." });
    } catch {
      setMsg({ kind: "error", text: "Could not copy; use Train it and copy the address bar." });
    }
  };

  const submit = async () => {
    const v = check();
    const sb = supabase();
    if (!v || !sb || !account.user) return;
    setBusy(true);
    const { error } = await sb.from("community_experiments").insert({ user_id: account.user.id, title: v.title, summary: v.summary, spec: v });
    setBusy(false);
    setMsg(error ? { kind: "error", text: error.message } : { kind: "notice", text: "Submitted. It appears in the community gallery once it has been reviewed." });
  };

  const labels = spec.world === "track" ? ["Wall close on the left excites", "Wall close on the right excites"] : ["Odour getting weaker excites", "Odour getting stronger excites"];

  return (
    <div className="builder">
      <section className="builder-col">
        <div className="builder-field">
          <label>Circuit</label>
          <div className="seg-list">
            {SPEC_SPECIES.map((s) => (
              <button key={s} type="button" className={species === s ? "on" : ""} onClick={() => chooseSpecies(s)}>
                {CIRCUITS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="builder-field">
          <label>World</label>
          <div className="seg-list row2">
            <button type="button" className={spec.world === "track" ? "on" : ""} onClick={() => setSpec({ ...spec, world: "track" })}>
              Drive a car round a track
            </button>
            <button type="button" className={spec.world === "plate" ? "on" : ""} onClick={() => setSpec({ ...spec, world: "plate" })}>
              Search for a smell on a plate
            </button>
          </div>
        </div>
        {!graph ? (
          <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
        ) : (
          <>
            <TargetList title={labels[0]} hint="Input neurons for the first sense." value={spec.sensors[0]} onChange={(v) => setSpec({ ...spec, sensors: [v, spec.sensors[1]] })} types={types} max={8} />
            <TargetList title={labels[1]} hint="Input neurons for the second sense." value={spec.sensors[1]} onChange={(v) => setSpec({ ...spec, sensors: [spec.sensors[0], v] })} types={types} max={8} />
            <TargetList title="Readout neurons" hint="Their firing rates are what the readout learns to use. Up to 40." value={spec.features} onChange={(v) => setSpec({ ...spec, features: v })} types={types} max={40} />
          </>
        )}
        <div className="builder-field">
          <label htmlFor="maxhz">Strongest input: {spec.maxHz} Hz</label>
          <input id="maxhz" type="range" min={20} max={300} step={10} value={spec.maxHz} onChange={(e) => setSpec({ ...spec, maxHz: Number(e.target.value) })} />
        </div>
      </section>

      <aside className="builder-col builder-side">
        <div className="builder-field">
          <label htmlFor="title">Title</label>
          <input id="title" className="field-input" maxLength={100} value={spec.title} onChange={(e) => setSpec({ ...spec, title: e.target.value })} placeholder="Escape neurons as a steering wheel" />
        </div>
        <div className="builder-field">
          <label htmlFor="summary">What does it test?</label>
          <textarea id="summary" className="field-input" rows={5} maxLength={600} value={spec.summary} onChange={(e) => setSpec({ ...spec, summary: e.target.value })} placeholder="Can the looming descending neurons alone carry enough information to steer?" />
          <p className="hint">{600 - spec.summary.length} characters left</p>
        </div>
        <div className="train-actions">
          <button type="button" className="btn primary" onClick={tryIt}>
            Train it
          </button>
          <button type="button" className="btn" onClick={() => void copy()}>
            Copy share link
          </button>
        </div>
        {account.enabled &&
          (account.user ? (
            <button type="button" className="btn" onClick={() => void submit()} disabled={busy}>
              {busy ? "Submitting…" : "Submit to the community"}
            </button>
          ) : (
            <p className="hint">
              <a href="/account">Sign in</a> to submit it to the community gallery.
            </p>
          ))}
        {msg && <p className={msg.kind === "error" ? "error" : "notice"}>{msg.text}</p>}
        <p className="hint">
          Experiments are data, not code: a circuit, two sets of input neurons and a list of readout neurons. Nothing you share
          can run code in anyone&apos;s browser.
        </p>
      </aside>
    </div>
  );
}
