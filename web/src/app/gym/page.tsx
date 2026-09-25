import type { Metadata } from "next";
import Link from "next/link";
import { FAMILIES, GYM, GYM_RESULTS, type GymEntry } from "@/lib/gym/catalog";
import { CIRCUIT_LABEL, type CircuitVariant } from "@/lib/training/types";

export const metadata: Metadata = {
  title: "Fly Gym",
  description:
    "Eight tasks for one real fly circuit, from feeding reflexes to poker, each measured on the real FlyWire wiring and on rewired, random and silenced controls.",
};

const VARIANTS: CircuitVariant[] = ["real", "degree", "random", "silenced"];

type Trained = { variants: Partial<Record<CircuitVariant, { heldOut: number; nash?: number }>>; generations: number; population: number };
type Reflex = { variants: Partial<Record<string, { metrics: Record<string, string> }>>; seconds: number; seeds: number };

function fmt(v: number | undefined) {
  if (v === undefined) return "·";
  return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/** Verdict for a trained task: does the real circuit beat every control on the held out test? */
function verdict(r: Trained | undefined, e?: GymEntry) {
  const real = r?.variants.real?.heldOut;
  if (real === undefined) return null;
  const ctrl = (["degree", "random", "silenced"] as CircuitVariant[]).map((k) => r!.variants[k]?.heldOut).filter((x): x is number => x !== undefined);
  if (!ctrl.length) return null;
  if (e?.chance !== undefined && e.best !== undefined) {
    const span = e.best - e.chance;
    if ([real, ...ctrl].every((v) => Math.abs(v - e.chance!) < 0.1 * span)) return { tone: "even", text: "No circuit gets above chance" };
  }
  const best = Math.max(...ctrl);
  const spread = Math.max(1e-6, Math.abs(real) + Math.abs(best));
  if (real > best + 0.05 * spread) return { tone: "good", text: "Real wiring beats every control" };
  if (real >= best - 0.05 * spread) return { tone: "even", text: "Real and controls about equal" };
  return { tone: "bad", text: "A control does better" };
}

function TrainedTable({ e }: { e: GymEntry }) {
  const r = GYM_RESULTS[e.id] as Trained | undefined;
  const vals = VARIANTS.map((k) => r?.variants[k]?.heldOut);
  const known = vals.filter((v): v is number => v !== undefined);
  const lo = Math.min(e.chance ?? Infinity, ...known), hi = Math.max(e.best ?? -Infinity, ...known);
  const span = Math.max(1e-6, hi - lo);
  const v = verdict(r, e);
  return (
    <>
      <table className="gym-table">
        <tbody>
          {VARIANTS.map((k, i) => (
            <tr key={k} className={k === "real" ? "real" : ""}>
              <th>{CIRCUIT_LABEL[k]}</th>
              <td className="gym-bar">
                <span style={{ width: vals[i] === undefined ? 0 : `${Math.max(2, ((vals[i]! - lo) / span) * 100)}%` }} />
              </td>
              <td className="num">{fmt(vals[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r?.variants.real?.nash !== undefined && <p className="gym-note">Against the equilibrium player: {r.variants.real.nash.toFixed(3)} chips per hand (0 is the best possible).</p>}
      {v && <p className={`gym-verdict ${v.tone}`}>{v.text}</p>}
    </>
  );
}

const REFLEX_ROWS: Record<string, { label: string; key: string; good: boolean }[]> = {
  "gym-feeding": [
    { label: "Sugar drops drunk", key: "Sugar drops drunk", good: true },
    { label: "Bitter drops drunk", key: "Bitter drops drunk", good: false },
    { label: "Sugar with bitter drunk", key: "Sugar with bitter drunk", good: false },
  ],
  "gym-backaway": [
    { label: "Backed away from the wall", key: "Backed away", good: true },
    { label: "Backed away with no wall near", key: "Backed away with no wall near", good: false },
    { label: "Bumped into the wall", key: "Bumped into the wall", good: false },
  ],
};

function ReflexTable({ e }: { e: GymEntry }) {
  const r = GYM_RESULTS[e.id] as Reflex | undefined;
  const rows = REFLEX_ROWS[e.id] ?? [];
  const cols = ["real", "degree", "random"];
  return (
    <table className="gym-table reflex">
      <thead>
        <tr>
          <th />
          {cols.map((c) => (
            <th key={c} className="num">
              {c === "real" ? "Real" : c === "degree" ? "Rewired" : "Random"}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th>{row.label}</th>
            {cols.map((c) => (
              <td key={c} className={`num ${c === "real" ? "real" : ""}`}>
                {r?.variants[c]?.metrics[row.key] ?? "·"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function GymPage() {
  const trained = GYM.filter((g) => g.kind === "trained").map((g) => verdict(GYM_RESULTS[g.id] as Trained | undefined, g));
  const wins = trained.filter((v) => v?.tone === "good").length;
  return (
    <div className="wrap">
      <header className="page-head compact">
        <div>
          <div className="eyebrow">Fly Gym</div>
          <h1>One real fly circuit, eight very different tasks</h1>
          <p className="lede">
            Feeding, backing away from walls, poker, Pong, an odour maze, a two flower gamble, gusty flight and a chase. Every
            task runs on the same 1,846 neurons cut from the FlyWire connectome, and every result is shown next to the same
            task on rewired, random and silenced circuits. The question is never only whether the fly can do it, but whether
            the real wiring is what makes it possible.
          </p>
        </div>
      </header>

      <section className="panel block prose gym-how">
        <h3>How a task works</h3>
        <p>
          Senses drive real sensory neurons: taste neurons for sugar and bitter, olfactory receptor neurons for odours, visual
          projection neurons for objects and looming, HS cells for self motion. Activity then spreads through every measured
          synapse between them and the descending neurons that command the body, plus MN9, the proboscis motor neuron.
        </p>
        <p>
          The two behaviours need no training: the wiring alone has to produce them. The six other tasks train a small linear
          readout of 21 output neurons with the cross entropy method; the circuit never changes. The benchmark trains the real
          circuit and each control with the same seed, population and number of generations, and scores them on settings they
          never trained on. {wins > 0 && <>So far the real wiring beats every control on {wins} of {trained.length} trained tasks.</>}
        </p>
      </section>

      {FAMILIES.map((f) => (
        <section key={f.id} className="gym-family">
          <div className="gym-family-head">
            <h2>{f.title}</h2>
            <p>{f.blurb}</p>
          </div>
          <div className="gym-grid">
            {GYM.filter((g) => g.family === f.id).map((e) => (
              <article key={e.id} className="gym-card">
                <div className="gym-card-head">
                  <span className="eyebrow">{e.kind === "reflex" ? "No training" : "Trained readout"}</span>
                  <h3>{e.title}</h3>
                  <p>{e.measure}</p>
                </div>
                {e.kind === "trained" ? <TrainedTable e={e} /> : <ReflexTable e={e} />}
                <div className="gym-actions">
                  <Link className="btn primary" href={`/experiments/${e.experimentId}`}>
                    Watch it live
                  </Link>
                  {e.taskId && (
                    <Link className="btn" href={`/train/${e.taskId}`}>
                      Train it yourself
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="panel block prose" style={{ marginTop: 28 }}>
        <h3>Honest limits</h3>
        <p>
          Sensory encodings for games are arbitrary: the fly does not know what a card is; the jack, queen and king simply
          drive three different groups of visual neurons. The readout is linear, so any skill beyond a lookup has to come
          from the circuit. There is no learning inside the circuit, so tasks that need memory across seconds are expected to
          sit near chance, and the page says so when they do. Every number comes from{" "}
          <code>web/scripts/gym-benchmark.ts</code> and can be reproduced.
        </p>
      </section>
    </div>
  );
}
