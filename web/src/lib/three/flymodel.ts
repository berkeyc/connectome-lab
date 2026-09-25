// The realistic fruit fly: the flybody model (TuragaLab, Apache-2.0), rebuilt as
// an articulated glTF by pipeline/build_fly_model.py, dressed with our macro
// textures (compound eye, iridescent wing, hairy thorax, banded abdomen).
// Legs and wings are posed each frame from the joints stored in the file, so
// the fly walks with a tripod gait, folds its wings at rest and beats them in
// flight. Until the model has loaded (or if it cannot load) the small
// procedural fly stands in, so a scene never waits on the network.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { animateFly, makeFly, type FlyModel } from "./models";

export { FLY_CREDIT } from "./credits";

export type Tier = "high" | "low";

/** Cheap guess of what the GPU can take. Software rendering and small devices get the light model. */
export function gpuTier(renderer: THREE.WebGLRenderer): Tier {
  // ?quality=high or ?quality=low overrides the guess (for testing and screenshots)
  if (typeof location !== "undefined") {
    const q = new URLSearchParams(location.search).get("quality");
    if (q === "high" || q === "low") return q;
  }
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return "low";
  } catch {
    /* unknown: decide by the device below */
  }
  if (typeof window !== "undefined") {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const cores = navigator.hardwareConcurrency || 4;
    if (coarse || cores <= 4) return "low";
  }
  return "high";
}

type Joint = { name: string; axis: number[]; ref: number; range: number[] | null };
type Articulated = {
  node: THREE.Object3D;
  quat0: THREE.Quaternion;
  joints: { axis: THREE.Vector3; ref: number; lo: number; hi: number; name: string }[];
};

const templates = new Map<Tier, Promise<THREE.Object3D>>();

function tex(loader: THREE.TextureLoader, url: string, color: boolean, repeat?: THREE.Wrapping) {
  const t = loader.load(url);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = repeat;
  return t;
}

function materials(tier: Tier) {
  const L = new THREE.TextureLoader();
  const hi = tier === "high";
  const base = "/textures/fly/";
  const eye = new THREE.MeshPhysicalMaterial({
    name: "eye",
    map: tex(L, base + "eye.webp", true, THREE.MirroredRepeatWrapping),
    // deepen the red so tone mapping does not push the bright eye towards pink
    color: 0xd8473a,
    roughness: 0.5,
    envMapIntensity: 0.6,
    clearcoat: hi ? 0.7 : 0,
    clearcoatRoughness: 0.18,
    sheen: hi ? 0.12 : 0,
    sheenColor: new THREE.Color(0xff5a3c),
    sheenRoughness: 0.5,
  });
  if (hi) {
    const n = tex(L, base + "eye-normal.webp", false, THREE.MirroredRepeatWrapping);
    eye.normalMap = n;
    eye.normalScale.set(0.6, 0.6);
    eye.clearcoatNormalMap = n;
  }
  const thorax = new THREE.MeshPhysicalMaterial({
    name: "thorax",
    map: tex(L, base + "thorax.webp", true, THREE.MirroredRepeatWrapping),
    color: 0xe6c79a,
    roughness: 0.6,
    sheen: hi ? 1 : 0,
    sheenColor: new THREE.Color(0xe0b060),
    sheenRoughness: 0.35,
  });
  if (hi) thorax.normalMap = tex(L, base + "thorax-normal.webp", false, THREE.MirroredRepeatWrapping);
  const abdomen = new THREE.MeshPhysicalMaterial({
    name: "abdomen",
    map: tex(L, base + "abdomen.webp", true, THREE.MirroredRepeatWrapping),
    roughness: 0.45,
    clearcoat: hi ? 0.4 : 0,
    clearcoatRoughness: 0.3,
  });
  const wing = new THREE.MeshPhysicalMaterial({
    name: "wing",
    map: tex(L, base + "wing.webp", true, THREE.ClampToEdgeWrapping),
    color: 0xb9c0c6, // a wing is mostly clear: keep it from turning into a white sheet under strong light
    envMapIntensity: 0.6,
    roughness: 0.22,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 520],
  });
  wing.forceSinglePass = true;
  const body = new THREE.MeshPhysicalMaterial({
    name: "body",
    color: 0xb07a45,
    roughness: 0.5,
    sheen: hi ? 0.6 : 0,
    sheenColor: new THREE.Color(0xe0a860),
    sheenRoughness: 0.4,
  });
  return {
    eye,
    thorax,
    abdomen,
    wing,
    body,
    lower: new THREE.MeshStandardMaterial({ name: "lower", color: 0xd8b98a, roughness: 0.6 }),
    bristle: new THREE.MeshStandardMaterial({ name: "bristle", color: 0x120c08, roughness: 0.4 }),
    ocelli: new THREE.MeshStandardMaterial({ name: "ocelli", color: 0x3a1206, roughness: 0.2 }),
    claw: new THREE.MeshStandardMaterial({ name: "claw", color: 0x2a1408, roughness: 0.4 }),
  } as Record<string, THREE.Material>;
}

function loadTemplate(tier: Tier) {
  let p = templates.get(tier);
  if (!p) {
    p = (async () => {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(tier === "high" ? "/models/fly-hi.glb" : "/models/fly-lo.glb");
      const mats = materials(tier);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const name = (m.material as THREE.Material).name;
        (m.material as THREE.Material).dispose();
        m.material = mats[name] ?? mats.body;
        m.castShadow = name !== "wing" && name !== "bristle";
        m.receiveShadow = false;
        if (name === "wing") m.renderOrder = 2;
      });
      return gltf.scene;
    })();
    // a failed load may succeed later (flaky network), so do not cache the failure
    p.catch(() => templates.delete(tier));
    templates.set(tier, p);
  }
  return p;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Folded wings, found by searching the joint ranges for wings flat over the abdomen. */
const WING_REST = { yaw: -0.1, roll: 0.25, pitch: 0.23 };
const ABDOMEN = ["abdomen", "abdomen_2", "abdomen_3", "abdomen_4", "abdomen_5", "abdomen_6", "abdomen_7"];

/** Joint name suffixes of the six legs, front to back. */
const LEGS = ["T1_left", "T1_right", "T2_left", "T2_right", "T3_left", "T3_right"];
/** Tripod gait: front and hind legs of one side move with the middle leg of the other. */
const TRIPOD = [0, 1, 1, 0, 0, 1];

class RealFly {
  readonly root: THREE.Object3D;
  private nodes = new Map<string, Articulated>();
  private angles = new Map<string, number>();
  private wingMat: THREE.MeshPhysicalMaterial | null = null;
  private phase = 0;
  private wingPhase = 0;
  private spread = 0;
  private tSec = 0;
  private prob = 0;

  constructor(template: THREE.Object3D) {
    this.root = template.clone(true);
    this.root.traverse((o) => {
      const j = o.userData?.joints as Joint[] | undefined;
      const q0 = o.userData?.quat0 as number[] | undefined;
      if (j && q0) {
        this.nodes.set(o.name, {
          node: o,
          quat0: new THREE.Quaternion(q0[0], q0[1], q0[2], q0[3]),
          joints: j.map((x) => ({
            name: x.name,
            axis: new THREE.Vector3(x.axis[0], x.axis[1], x.axis[2]).normalize(),
            ref: x.ref,
            lo: x.range ? x.range[0] : -Math.PI,
            hi: x.range ? x.range[1] : Math.PI,
          })),
        });
      }
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === "wing") {
        // each fly gets its own wing material so a beating fly can blur its wings alone
        if (!this.wingMat) this.wingMat = (m.material as THREE.MeshPhysicalMaterial).clone();
        m.material = this.wingMat;
      }
    });
  }

  /** Offset of one joint from its resting angle, in radians. */
  private set(name: string, offset: number) {
    this.angles.set(name, offset);
  }

  private apply() {
    const q = new THREE.Quaternion();
    for (const a of this.nodes.values()) {
      a.node.quaternion.copy(a.quat0);
      for (const j of a.joints) {
        const off = this.angles.get(j.name) ?? 0;
        const ang = THREE.MathUtils.clamp(j.ref + off, j.lo, j.hi);
        a.node.quaternion.multiply(q.setFromAxisAngle(j.axis, ang));
      }
    }
  }

  animate(dt: number, o: { flap: number; walk: number; proboscis?: number }) {
    dt = Math.min(dt, 0.05);
    this.tSec += dt;
    // wings: fold (0) or beat (1), with a short ease so take off does not snap
    const target = o.flap > 0.02 ? 1 : 0;
    this.spread += (target - this.spread) * (1 - Math.exp(-dt * 14));
    // the real stroke is about 200 Hz; drawn at 60 fps it would alias, so show a slower
    // beat and let the wing blur (lower opacity) carry the speed
    this.wingPhase += dt * Math.PI * 2 * (10 + 6 * o.flap);
    const s = Math.sin(this.wingPhase), c = Math.cos(this.wingPhase);
    for (const side of ["left", "right"]) {
      // offsets from the model's spring reference (yaw 1.5, roll 0.7, pitch -1): at rest the
      // wings lie flat over the abdomen; in flight they stroke up and down around the spread position
      const rest = WING_REST;
      this.set(`wing_yaw_${side}`, mix(rest.yaw, -1.5 + 0.35 + 0.75 * s, this.spread));
      this.set(`wing_roll_${side}`, mix(rest.roll, -0.7, this.spread));
      this.set(`wing_pitch_${side}`, mix(rest.pitch, 1.0 + 0.5 * c, this.spread));
    }
    // a straighter abdomen than the model's default, so the folded wings rest along it
    for (const a of ABDOMEN) this.set(a, 0.04 + (a === "abdomen" ? Math.sin(this.tSec * 1.3) * 0.03 : 0));
    if (this.wingMat) this.wingMat.opacity = 1 - 0.45 * this.spread;
    // legs: tripod gait while walking, tucked in flight
    this.phase += dt * Math.PI * 2 * 5.5 * Math.min(1, o.walk);
    const w = Math.min(1, o.walk) * (1 - this.spread);
    LEGS.forEach((leg, i) => {
      const ph = this.phase + (TRIPOD[i] ? Math.PI : 0);
      const swing = Math.sin(ph);
      const lift = Math.max(0, Math.cos(ph));
      const front = i < 2 ? 1 : i < 4 ? 0.6 : -0.8;
      this.set(`coxa_${leg}`, w * swing * 0.28 * Math.sign(front || 1) + this.spread * 0.4);
      this.set(`femur_${leg}`, w * lift * 0.35 + this.spread * 0.6);
      this.set(`tibia_${leg}`, -w * lift * 0.3 - this.spread * 0.2);
    });
    // small head and antenna motion so a resting fly still looks alive
    this.set("head_abduct", Math.sin(this.tSec * 0.7) * 0.06);
    this.set("head", Math.sin(this.tSec * 0.45 + 1) * 0.05);
    this.set("antenna_left", Math.sin(this.tSec * 3.1) * 0.08);
    this.set("antenna_right", Math.sin(this.tSec * 2.7 + 0.5) * 0.08);
    // proboscis: MN9 unfolds the rostrum and the haustellum
    this.prob += ((o.proboscis ?? 0) - this.prob) * (1 - Math.exp(-dt * 12));
    this.set("rostrum", -1.1 * this.prob);
    this.set("haustellum", -1.4 * this.prob);
    this.apply();
  }

  dispose() {
    this.wingMat?.dispose();
  }
}

/**
 * A fly for any scene: starts as the procedural model, becomes the realistic one
 * as soon as it has loaded. Same size either way: 1 unit long, facing +x, feet on y = 0.
 */
export class FlyActor extends THREE.Group {
  private proc: FlyModel | null;
  private real: RealFly | null = null;
  private tSec = 0;
  private readyCbs: (() => void)[] = [];

  constructor(tier: Tier, opts: { shadows?: boolean } = {}) {
    super();
    this.proc = makeFly();
    this.add(this.proc);
    loadTemplate(tier)
      .then((tpl) => {
        if (!this.proc) return;
        this.real = new RealFly(tpl);
        if (opts.shadows === false) this.real.root.traverse((o) => ((o as THREE.Mesh).castShadow = false));
        this.real.root.userData.sharedAssets = true;
        this.remove(this.proc);
        this.proc.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        });
        this.proc = null;
        this.add(this.real.root);
        for (const cb of this.readyCbs) cb();
      })
      .catch(() => undefined);
  }

  /** Runs once the realistic model is in place (for camera framing, shadow updates). */
  onReady(cb: () => void) {
    if (this.real) cb();
    else this.readyCbs.push(cb);
  }

  get realistic() {
    return this.real !== null;
  }

  animate(dtSec: number, o: { flap: number; walk: number; proboscis?: number }) {
    this.tSec += dtSec;
    if (this.real) this.real.animate(dtSec, o);
    else if (this.proc) animateFly(this.proc, this.tSec, o);
  }

  dispose() {
    this.real?.dispose();
    this.proc = null;
  }
}
