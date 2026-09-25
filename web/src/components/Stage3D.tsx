"use client";
// The 3D stage: a world drawn in three.js, with two side panels like the
// connectome driving demos: the circuit's neurons at their real positions,
// flashing as they spike, and the fly whose brain it is.
import { useEffect, useRef, useState } from "react";
import type { SpikeBus } from "@/lib/three/brain";
import type { CameraMode, SceneKind } from "@/lib/three/scenes";
import { signalOf, type Snap } from "@/lib/three/snap";

export type BrainGeometry = { pos: number[]; cls: number[]; classes: string[]; bus: SpikeBus };

type Props = {
  kind: SceneKind;
  getSnap: () => Snap | null;
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
  return { left: s.reversing ? "reversing" : "crawling forward", right: s.food ? `${(Math.hypot(s.head.x - s.food.x, s.head.y - s.food.y) * 45).toFixed(1)} mm to food` : "" };
}

export default function Stage3D({ kind, getSnap, brain, showFly = true, badges, onUnavailable, compact = false }: Props) {
  const main = useRef<HTMLCanvasElement>(null);
  const brainC = useRef<HTMLCanvasElement>(null);
  const flyC = useRef<HTMLCanvasElement>(null);
  const hudL = useRef<HTMLSpanElement>(null);
  const hudR = useRef<HTMLSpanElement>(null);
  const sig = useRef<HTMLSpanElement>(null);
  const [camera, setCamera] = useState<CameraMode>(kind === "plate" ? "orbit" : "chase");
  const [loading, setLoading] = useState(true);
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
      const bv = brain && brainC.current ? new BrainView(brainC.current, brain.pos, brain.cls, brain.classes, brain.bus) : null;
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
      setLoading(false);
      const frame = (t: number) => {
        if (!alive) return;
        const dt = Math.min(100, t - last);
        last = t;
        const snap = getRef.current();
        fit(main.current, scene);
        fit(brainC.current, bv);
        fit(flyC.current, fv);
        scene.setCamera(camRef.current);
        if (snap) scene.update(snap, dt);
        scene.render();
        bv?.render(dt, !reduce);
        if (fv) {
          const turn = snap?.kind === "track" ? Math.max(-1, Math.min(1, snap.car.steer / 0.6)) : 0;
          const flap = snap?.kind === "loom" ? (snap.jump ? 1 : 0) : snap?.kind === "runner" ? (snap.flyY > 0.05 ? 1 : 0) : 0;
          const walk = snap?.kind === "runner" ? (snap.dead ? 0 : 1) : snap?.kind === "track" ? 0.6 : 0.2;
          fv.render(dt, { turn, flap, walk, spin: !reduce && snap?.kind !== "track" });
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

  const panels = Boolean(brain) || showFly;
  return (
    <div className={`stage3d ${compact ? "compact" : ""} ${panels ? "with-panels" : ""}`}>
      <div className="stage3d-main">
        <canvas ref={main} aria-label="3D view of the experiment" />
        {loading && <div className="stage3d-loading">Loading 3D view…</div>}
        <div className="stage3d-top">
          <div className="stage3d-badges">{badges}</div>
          <span ref={hudR} className="hud-val" />
        </div>
        <div className="stage3d-bottom">
          <span ref={hudL} className="hud-val" />
          {kind !== "runner" && (
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
              <span className="panel3d-label">Neural activity · {brain.cls.length.toLocaleString("en")} neurons at their FlyWire positions</span>
              <canvas ref={brainC} aria-label="Neurons of the circuit in 3D, flashing when they spike" />
            </div>
          )}
          {showFly && (
            <div className="panel3d">
              <span className="panel3d-label">
                Fly · <span ref={sig} className="panel3d-signal" />
              </span>
              <canvas ref={flyC} aria-label="The fly" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
