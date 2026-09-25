// Shared scene plumbing: renderer, lighting helpers and the base class with
// the post chain, camera and disposal every 3D scene needs.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FlyActor, gpuTier, type Tier } from "./flymodel";
import { applyHdri, Post, type HdriName } from "./look";
import type { Snap } from "./snap";

export type SceneKind = Snap["kind"];
export type CameraMode = "chase" | "orbit";

export interface Scene3D {
  update(snap: Snap, dtMs: number): void;
  render(): void;
  resize(w: number, h: number): void;
  setCamera(mode: CameraMode): void;
  setPixelRatio(r: number): void;
  /** Turn post processing off on slow machines (and back on). */
  setPost(on: boolean): void;
  dispose(): void;
}

export function makeRenderer(canvas: HTMLCanvasElement) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.AgXToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  return r;
}

/** Soft studio reflections right away; the HDRI replaces them once decoded. */
export function environment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.55) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = intensity;
  pm.dispose();
}

export function daylight(scene: THREE.Scene, sky: number, extent: number) {
  scene.background = new THREE.Color(sky);
  scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x55624a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.4);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = c.bottom = -extent;
  c.right = c.top = extent;
  c.near = 1;
  c.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return sun;
}

/** Free GPU memory, but leave assets shared between scenes (the loaded fly) alone. */
export function disposeScene(scene: THREE.Scene) {
  const shared = new Set<THREE.Object3D>();
  scene.traverse((o) => {
    if (o.userData.sharedAssets) o.traverse((c) => shared.add(c));
  });
  scene.traverse((o) => {
    if (shared.has(o)) return;
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
    (o as unknown as { dispose?: () => void }).dispose?.();
  });
}

export const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Frame-rate independent smoothing factor for a response rate in 1/s. */
export const damp = (rate: number, dtSec: number) => 1 - Math.exp(-rate * dtSec);

/** Renderer, post chain, camera and the chores every scene shares. */
export abstract class BaseScene implements Scene3D {
  protected scene = new THREE.Scene();
  protected renderer: THREE.WebGLRenderer;
  protected post: Post;
  protected postOn = true;
  protected mode: CameraMode = "chase";
  protected tier: Tier;
  protected flies: FlyActor[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    protected camera: THREE.PerspectiveCamera,
    look: { hdri: HdriName; env: number; bloom?: number; threshold?: number; vignette?: number },
  ) {
    this.renderer = makeRenderer(canvas);
    this.tier = gpuTier(this.renderer);
    environment(this.renderer, this.scene, look.env);
    void applyHdri(this.renderer, this.scene, look.hdri, look.env).catch(() => undefined);
    this.post = new Post(this.renderer, this.scene, camera, { bloom: look.bloom, threshold: look.threshold, vignette: look.vignette });
  }

  protected fly(tier: Tier = this.tier, opts: { shadows?: boolean } = {}) {
    const f = new FlyActor(tier, opts);
    this.flies.push(f);
    return f;
  }

  abstract update(snap: Snap, dtMs: number): void;

  render() {
    if (this.postOn) this.post.render(16);
    else this.renderer.render(this.scene, this.camera);
  }
  setPost(on: boolean) {
    this.postOn = on;
    this.renderer.toneMapping = on ? THREE.NoToneMapping : THREE.AgXToneMapping;
  }
  setPixelRatio(r: number) {
    this.renderer.setPixelRatio(r);
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  setCamera(m: CameraMode) {
    this.mode = m;
  }
  dispose() {
    for (const f of this.flies) f.dispose();
    this.post.dispose();
    disposeScene(this.scene);
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
