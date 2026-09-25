"use client";
// The 3D stage: a world drawn in three.js, with two side panels like the
// connectome driving demos: the circuit's neurons at their real positions,
// flashing as they spike, and the fly whose brain it is.
import { useEffect, useRef, useState } from "react";
import type { ActivityMode, BrainView as BrainViewT, Indicator, SpikeBus } from "@/lib/three/brain";
import { FLY_CREDIT } from "@/lib/three/credits";
import { SKELETON_CREDIT } from "@/lib/three/skeletons";
import type { CameraMode, SceneKind } from "@/lib/three/scenes";
import { lerpSnap, signalOf, type Snap } from "@/lib/three/snap";

export type BrainGeometry = { pos: number[]; cls: number[]; classes: string[]; ids?: string[]; bus: SpikeBus };

const INDICATOR_NAMES: Indicator[] = ["GCaMP6s", "GCaMP6f", "jGCaMP8f"];

type Props = {
  kind: SceneKind;
  /** The world's latest state and its simulation time (ms). */
  getSnap: () => { snap: Snap; t: number } | null;
  brain?: BrainGeometry | null;
  showFly?: boolean;
  badges?: React.ReactNode;
  onUnavailable?: () => void;
  compact?: boolean;
};

function hudFor(s: Snap | null) {
  if (!s) return { left: "", right: "" };
  if (s.kind === "track") {
    const deg = (s.car.steer * 180) / Math.PI;
    return { left: `Steering ${deg >= 0 ? "+" : ""}${deg.toFixed(1)}°`, right: `${(s.car.v * 3.6).toFixed(0)} km/h` };
  }
  if (s.kind === "loom") return { left: `Giant Fiber ${s.gf.toFixed(0)} Hz`, right: s.threat ? `object at ${s.threat.dist.toFixed(1)}` : "" };
  if (s.kind === "runner") return { left: `Giant Fiber ${s.gf.toFixed(0)} Hz`, right: s.dead ? "crashed" : "" };
  if (s.kind === "gym") return s.hud;
  return { left: s.reversing ? "reversing" : "crawling forward", right: s.food ? `${(Math.hypot(s.head.x - s.food.x, s.head.y - s.food.y) * 45).toFixed(1)} mm to food` : "" };
}

export default function Stage3D({ kind, getSnap, brain, showFly = true, badges, onUnavailable, compact = false }: Props) {
  const main = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const brainC = useRef<HTMLCanvasElement>(null);
  const flyC = useRef<HTMLCanvasElement>(null);
  const hudL = useRef<HTMLSpanElement>(null);
  const hudR = useRef<HTMLSpanElement>(null);
  const sig = useRef<HTMLSpanElement>(null);
  const [camera, setCamera] = useState<CameraMode>(kind === "plate" ? "orbit" : "chase");
  // gym scenes choose their own camera
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ActivityMode>("spikes");
  const [indicator, setIndicator] = useState<Indicator>("GCaMP6s");
  const [shapes, setShapes] = useState<"off" | "loading" | "on" | "failed">("off");
  const [shapeProgress, setShapeProgress] = useState("");
  const bvRef = useRef<BrainViewT | null>(null);
  const camRef = useRef(camera);
  const getRef = useRef(getSnap);
  useEffect(() => {
    camRef.current = camera;
    getRef.current = getSnap;
  }, [camera, getSnap]);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let cleanup = () => {};
    (async () => {
      const [{ createScene, webglAvailable }, { BrainView, FlyView }] = await Promise.all([import("@/lib/three/scenes"), import("@/lib/three/brain")]);
      if (!alive || !main.current) return;
      if (!webglAvailable()) {
        onUnavailable?.();
        return;
      }
      const scene = createScene(kind, main.current);
      // the whole brain envelope, fitted to all FlyWire neuron positions (FlyWire circuits only)
      let surface: { v: number[]; f: number[] } | null = null;
      if (brain?.ids?.[0] && /^\d{15,20}$/.test(brain.ids[0])) {
        surface = await fetch("/data/species/fruit-fly-flywire/surface.json")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (!alive) return;
      }
      const bv = brain && brainC.current ? new BrainView(brainC.current, { ...brain, surface }) : null;
      bvRef.current = bv;
      const fv = showFly && flyC.current ? new FlyView(flyC.current) : null;
      const sizes = new Map<HTMLCanvasElement, string>();
      const fit = (c: HTMLCanvasElement | null, r: { resize(w: number, h: number): void } | null) => {
        if (!c || !r) return;
        const key = `${c.clientWidth}x${c.clientHeight}`;
        if (sizes.get(c) !== key) {
          sizes.set(c, key);
          r.resize(c.clientWidth, c.clientHeight);
        }
      };
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      let last = performance.now();
      let lastHud = 0;
      let prev: { snap: Snap; t: number } | null = null;
      let cur: { snap: Snap; t: number } | null = null;
      let curWall = 0;
      let interval = 20;
      let frameAvg = 16;
      const maxDpr = Math.min(window.devicePixelRatio || 1, 1.75);
      let dpr = maxDpr;
      let lastDpr = 0;
      let postOn = true;
      // stop drawing while the stage is scrolled out of view
      let visible = true;
      const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true));
      if (rootRef.current) io.observe(rootRef.current);
      setLoading(false);
      const frame = (t: number) => {
        if (!alive) return;
        const dt = Math.min(100, t - last);
        last = t;
        // interpolate between the last two simulation steps
        const got = getRef.current();
        if (got) {
          if (!cur || got.t < cur.t) {
            prev = got;
            cur = got;
            curWall = t;
          } else if (got.t !== cur.t) {
            interval += (Math.min(200, Math.max(8, t - curWall)) - interval) * 0.2;
            prev = cur;
            cur = got;
            curWall = t;
          }
        }
        const alpha = interval > 0 ? Math.min(1, (t - curWall) / interval) : 1;
        const snap = cur && prev ? lerpSnap(prev.snap, cur.snap, alpha) : null;
        // adaptive resolution: step the pixel ratio down when frames run long, back up when there is room
        frameAvg += (dt - frameAvg) * 0.05;
        if (t - lastDpr > 1500) {
          if (frameAvg > 30 && dpr <= 0.7 && postOn) {
            // still too slow at the lowest resolution: drop the post processing
            postOn = false;
            scene.setPost(false);
            lastDpr = t;
          } else if (frameAvg > 22 && dpr > 0.7) {
            dpr = Math.max(0.7, dpr - 0.2);
            scene.setPixelRatio(dpr);
            sizes.clear();
            lastDpr = t;
          } else if (frameAvg < 13 && dpr < maxDpr) {
            dpr = Math.min(maxDpr, dpr + 0.1);
            scene.setPixelRatio(dpr);
            sizes.clear();
            lastDpr = t;
          }
        }
        if (!visible) {
          raf = requestAnimationFrame(frame);
          return;
        }
        fit(main.current, scene);
        fit(brainC.current, bv);
        fit(flyC.current, fv);
        scene.setCamera(camRef.current);
        if (snap) scene.update(snap, dt);
        scene.render();
        bv?.render(dt, !reduce);
        if (fv) {
          const turn = snap?.kind === "track" ? Math.max(-1, Math.min(1, snap.car.steer / 0.6)) : snap?.kind === "gym" ? Math.max(-1, Math.min(1, (snap.fly.roll ?? 0) * 2)) : 0;
          const flap = snap?.kind === "loom" ? (snap.jump ? 1 : 0) : snap?.kind === "runner" ? (snap.flyY > 0.05 ? 1 : 0) : snap?.kind === "gym" ? snap.fly.flap : 0;
          const walk = snap?.kind === "runner" ? (snap.dead ? 0 : 1) : snap?.kind === "track" ? 0.6 : snap?.kind === "gym" ? snap.fly.walk : 0.2;
          const proboscis = snap?.kind === "gym" ? snap.fly.proboscis : 0;
          fv.render(dt, { turn, flap, walk, proboscis, spin: !reduce && snap?.kind !== "track" });
        }
        if (t - lastHud > 120) {
          lastHud = t;
          const h = hudFor(snap);
          if (hudL.current) hudL.current.textContent = h.left;
          if (hudR.current) hudR.current.textContent = h.right;
          if (sig.current) sig.current.textContent = signalOf(snap);
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      cleanup = () => {
        io.disconnect();
        bvRef.current = null;
        scene.dispose();
        bv?.dispose();
        fv?.dispose();
      };
    })().catch(() => onUnavailable?.());
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      cleanup();
    };
    // the scene is rebuilt only when the kind of world or the brain changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, brain, showFly]);

  useEffect(() => {
    bvRef.current?.setMode(mode);
    bvRef.current?.setIndicator(indicator);
  }, [mode, indicator, loading]);

  const toggleShapes = async () => {
    const bv = bvRef.current;
    if (!bv) return;
    if (shapes === "on") {
      bv.hideShapes();
      setShapes("off");
      return;
    }
    setShapes("loading");
    const n = await bv.loadShapes(48, (d, t) => setShapeProgress(`${d}/${t}`));
    setShapes(n > 0 ? "on" : "failed");
  };

  const flywire = Boolean(brain?.ids?.[0] && /^\d{15,20}$/.test(brain.ids[0]));
  const panels = Boolean(brain) || showFly;
  return (
    <div ref={rootRef} className={`stage3d ${compact ? "compact" : ""} ${panels ? "with-panels" : ""}`}>
      <div className="stage3d-main">
        <canvas ref={main} aria-label="3D view of the experiment" />
        {loading && <div className="stage3d-loading">Loading 3D view…</div>}
        <div className="stage3d-top">
          <div className="stage3d-badges">{badges}</div>
          <span ref={hudR} className="hud-val" />
        </div>
        <div className="stage3d-bottom">
          <span ref={hudL} className="hud-val" />
          {kind !== "runner" && kind !== "gym" && (
            <div className="cam-toggle" role="radiogroup" aria-label="Camera">
              {(["chase", "orbit"] as CameraMode[]).map((m) => (
                <button key={m} role="radio" aria-checked={camera === m} className={camera === m ? "on" : ""} onClick={() => setCamera(m)}>
                  {m === "chase" ? "Follow" : "Overview"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {panels && (
        <div className="stage3d-panels">
          {brain && (
            <div className="panel3d">
              <span className="panel3d-label">
                {mode === "calcium" ? "Simulated calcium imaging" : "Neural activity"} · {brain.cls.length.toLocaleString("en")} neurons at their FlyWire positions
              </span>
              <div className="panel3d-tools">
                <div className="mini-seg" role="radiogroup" aria-label="Activity view">
                  {(["spikes", "calcium"] as ActivityMode[]).map((m) => (
                    <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
                      {m === "spikes" ? "Spikes" : "Calcium"}
                    </button>
                  ))}
                </div>
                {mode === "calcium" && (
                  <select className="mini-select" value={indicator} onChange={(e) => setIndicator(e.target.value as Indicator)} aria-label="Calcium indicator">
                    {INDICATOR_NAMES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                )}
                {flywire && (
                  <button className={`mini-btn ${shapes === "on" ? "on" : ""}`} onClick={() => void toggleShapes()} disabled={shapes === "loading"} title={SKELETON_CREDIT}>
                    {shapes === "loading" ? `Loading shapes ${shapeProgress}` : shapes === "on" ? "Hide shapes" : shapes === "failed" ? "Shapes unavailable" : "Real shapes"}
                  </button>
                )}
              </div>
              <canvas ref={brainC} aria-label="Neurons of the circuit in 3D, flashing when they spike" />
            </div>
          )}
          {showFly && (
            <div className="panel3d">
              <span className="panel3d-label" title={FLY_CREDIT}>
                Fly · <span ref={sig} className="panel3d-signal" />
              </span>
              <canvas ref={flyC} aria-label="The fly, a model of Drosophila melanogaster" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
