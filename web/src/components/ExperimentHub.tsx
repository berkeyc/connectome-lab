"use client";
// All experiments in one place, grouped by family, with filters for the kind
// of task, the animal and whether it runs in the browser.
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Family } from "@/lib/site";
import Thumb from "./Thumb";
import WorldThumb from "./WorldThumb";

export type HubItem = {
  id: string;
  title: string;
  tagline: string;
  family: Family;
  animal: "fly" | "worm";
  kind: "reflex" | "trained" | "teaching" | "local";
  clip: string | null;
  image?: string;
  has2d: boolean;
  circuit: string;
};

const KIND_LABEL: Record<HubItem["kind"], string> = {
  reflex: "No training",
  trained: "Trained readout",
  teaching: "Teaching brain",
  local: "Local runner",
};

export default function ExperimentHub({ items, families }: { items: HubItem[]; families: { id: Family; title: string; blurb: string }[] }) {
  const [family, setFamily] = useState<Family | "all">("all");
  const [animal, setAnimal] = useState<"all" | "fly" | "worm">("all");
  const shown = useMemo(() => items.filter((i) => (family === "all" || i.family === family) && (animal === "all" || i.animal === animal)), [items, family, animal]);
  const count = (f: Family | "all") => items.filter((i) => (f === "all" || i.family === f) && (animal === "all" || i.animal === animal)).length;

  return (
    <>
      <div className="filters" role="toolbar" aria-label="Filter experiments">
        <div className="seg" role="radiogroup" aria-label="Kind of task">
          {[{ id: "all" as const, title: "All" }, ...families].map((f) => (
            <button key={f.id} role="radio" aria-checked={family === f.id} className={family === f.id ? "on" : ""} onClick={() => setFamily(f.id)}>
              {f.title} <span className="seg-count">{count(f.id)}</span>
            </button>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label="Animal">
          {(["all", "fly", "worm"] as const).map((a) => (
            <button key={a} role="radio" aria-checked={animal === a} className={animal === a ? "on" : ""} onClick={() => setAnimal(a)}>
              {a === "all" ? "Both animals" : a === "fly" ? "Fruit fly" : "Worm"}
            </button>
          ))}
        </div>
      </div>

      {families
        .filter((f) => family === "all" || f.id === family)
        .map((f) => {
          const list = shown.filter((i) => i.family === f.id);
          if (!list.length) return null;
          return (
            <section key={f.id} className="hub-section" aria-labelledby={`fam-${f.id}`}>
              <div className="hub-head">
                <h2 id={`fam-${f.id}`}>{f.title}</h2>
                <p>{f.blurb}</p>
              </div>
              <div className="card-grid">
                {list.map((i) => (
                  <Link key={i.id} href={`/experiments/${i.id}`} className="pcard">
                    {i.clip || i.image ? (
                      <Thumb clip={i.clip} image={i.image} alt={i.title} className="pcard-media" />
                    ) : i.has2d ? (
                      <div className="thumb pcard-media">
                        <WorldThumb id={i.id} />
                      </div>
                    ) : (
                      <div className="thumb pcard-media thumb-empty" aria-hidden="true" />
                    )}
                    <div className="pcard-body">
                      <span className="pcard-eyebrow">{i.circuit}</span>
                      <h3>{i.title}</h3>
                      <p>{i.tagline}</p>
                      <div className="pcard-tags">
                        <span className={`tag ${i.kind === "reflex" ? "real" : i.kind === "teaching" ? "warn" : "plain"}`}>{KIND_LABEL[i.kind]}</span>
                        <span className="tag plain">{i.animal === "fly" ? "Fruit fly" : "Worm"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      {!shown.length && <p className="muted">No experiments match these filters.</p>}
    </>
  );
}
