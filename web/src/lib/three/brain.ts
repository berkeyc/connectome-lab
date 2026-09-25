// 3D neural activity. Every neuron of the circuit at its measured FlyWire
// position, shown either as spikes (instant flashes) or as simulated calcium
// imaging (slow green fluorescence, as a microscope would see it). Optional:
// the envelope of the whole fly brain, and the real skeletons of chosen neurons.
// Also a small fly panel.
import * as THREE from "three";
import { animateFly, makeFly, type FlyModel } from "./models";
import { fetchSkeletons } from "./skeletons";

const CLASS_COLOR: Record<string, number> = {
  sensory: 0xe0a458,
  optic: 0xd98c5f,
  visual_projection: 0xe07b4f,
  central: 0x7aa7d9,
  interneuron: 0x7aa7d9,
  descending: 0x5ecb8f,
  ascending: 0x9fd18b,
  motor: 0x5ecb8f,
  other: 0x8c96a3,
};

/** Spike counts per neuron since the last frame, written by the brain loop. */
export type SpikeBus = { n: number; activity: Float32Array };

export type ActivityMode = "spikes" | "calcium";

/**
 * Calcium indicators: fluorescence follows a rising and a decaying exponential
 * after each spike, F = x_decay - x_rise, saturating as F / (F + K). Kinetics are
 * approximate single spike values from Chen et al. 2013 (GCaMP6) and Zhang et
 * al. 2023 (jGCaMP8); shot noise is added so the picture looks like imaging.
 */
export const INDICATORS = {
  GCaMP6s: { riseMs: 180, decayMs: 1100, label: "GCaMP6s (slow, bright)" },
  GCaMP6f: { riseMs: 45, decayMs: 200, label: "GCaMP6f (fast)" },
  jGCaMP8f: { riseMs: 3, decayMs: 40, label: "jGCaMP8f (fastest)" },
} as const;
export type Indicator = keyof typeof INDICATORS;

export type BrainViewOptions = {
  pos: ArrayLike<number>;
  cls: number[];
  classes: string[];
  ids?: string[];
  bus: SpikeBus;
  surface?: { v: number[]; f: number[] } | null;
};

export class BrainView {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  private renderer: THREE.WebGLRenderer;
  private points: THREE.Points;
  private act: THREE.BufferAttribute;
  private calc: THREE.BufferAttribute;
  private radius: number;
  private angle = 0.6;
  private center: THREE.Vector3;
  private xr: Float32Array;
  private xd: Float32Array;
  private mode: ActivityMode = "spikes";
  private indicator: Indicator = "GCaMP6s";
  private skeletons: { idx: number; line: THREE.LineSegments; base: THREE.Color }[] = [];
  private rnd = 0;

  constructor(canvas: HTMLCanvasElement, private o: BrainViewOptions) {
    const { pos, cls, classes } = o;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const n = cls.length;
    this.xr = new Float32Array(n);
    this.xd = new Float32Array(n);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      cx += pos[i * 3];
      cy += pos[i * 3 + 1];
      cz += pos[i * 3 + 2];
    }
    this.center = new THREE.Vector3(cx / n, cy / n, cz / n);
    const P = new Float32Array(n * 3);
    let r = 1;
    for (let i = 0; i < n; i++) {
      const v = this.local(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      P.set([v.x, v.y, v.z], i * 3);
      r = Math.max(r, v.length());
    }
    this.radius = r;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.set(CLASS_COLOR[classes[cls[i]]] ?? CLASS_COLOR.other);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.act = new THREE.BufferAttribute(new Float32Array(n), 1);
    this.calc = new THREE.BufferAttribute(new Float32Array(n), 1);
    g.setAttribute("activity", this.act);
    g.setAttribute("calcium", this.calc);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 1 }, mode: { value: 0 }, dist: { value: 1000 } },
      vertexShader: `
        attribute vec3 color; attribute float activity; attribute float calcium;
        uniform float scale; uniform float mode; uniform float dist;
        varying vec3 vColor; varying float vA; varying float vC;
        void main() {
          vColor = color; vA = activity; vC = calcium;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float s = mode < 0.5 ? (4.5 + 9.0 * activity) : (5.0 + 7.0 * calcium);
          gl_PointSize = scale * s * 1.3 * (dist / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float mode;
        varying vec3 vColor; varying float vA; varying float vC;
        void main() {
          vec2 d = gl_PointCoord - 0.5; float r = length(d);
          if (r > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, r);
          if (mode < 0.5) {
            vec3 col = mix(vColor * 0.8, vec3(1.0, 0.97, 0.9), vA * 0.8);
            gl_FragColor = vec4(col, glow * (0.42 + 0.58 * vA));
          } else {
            // GCaMP green on a dark field: dim baseline, bright when calcium rises
            vec3 col = mix(vec3(0.05, 0.16, 0.08), vec3(0.55, 1.0, 0.45), vC);
            gl_FragColor = vec4(col, glow * (0.18 + 0.82 * vC));
          }
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.scene.add(this.points);
    if (o.surface) this.addSurface(o.surface);
  }

  /** FlyWire micrometres to view space: centred on the circuit, y up. */
  private local(x: number, y: number, z: number) {
    return new THREE.Vector3(x - this.center.x, -(y - this.center.y), z - this.center.z);
  }

  private addSurface(s: { v: number[]; f: number[] }) {
    const P = new Float32Array(s.v.length);
    for (let i = 0; i < s.v.length; i += 3) {
      const v = this.local(s.v[i], s.v[i + 1], s.v[i + 2]);
      P.set([v.x, v.y, v.z], i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P, 3));
    g.setIndex(s.f);
    g.computeVertexNormals();
    // a fresnel style shell: edges of the brain glow faintly, the middle stays clear
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { tint: { value: new THREE.Color(0x6f93ad) } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 tint; varying vec3 vN; varying vec3 vV;
        void main() { float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(tint, 0.03 + 0.22 * f); }`,
    });
    this.scene.add(new THREE.Mesh(g, mat));
    g.computeBoundingSphere();
    // frame the whole brain when the envelope is shown
    const bs = g.boundingSphere!;
    this.radius = Math.max(this.radius, bs.radius + bs.center.length() * 0.5);
  }

  setMode(m: ActivityMode) {
    this.mode = m;
    (this.points.material as THREE.ShaderMaterial).uniforms.mode.value = m === "calcium" ? 1 : 0;
    this.points.visible = true;
  }

  setIndicator(i: Indicator) {
    this.indicator = i;
  }

  /**
   * Load the real skeletons of up to `max` neurons, preferring descending and
   * other output neurons. Returns how many were drawn.
   */
  async loadShapes(max: number, onProgress: (done: number, total: number) => void): Promise<number> {
    const ids = this.o.ids;
    if (!ids) return 0;
    const cls = this.o.cls, classes = this.o.classes;
    const rank = (i: number) => {
      const k = classes[cls[i]];
      return k === "descending" ? 0 : k === "visual_projection" || k === "sensory" ? 2 : 1;
    };
    const order = ids.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b);
    // keep each class represented: all of the first rank, then an even sample of the rest
    const first = order.filter((i) => rank(i) === 0).slice(0, Math.ceil(max * 0.6));
    const rest = order.filter((i) => rank(i) !== 0);
    const step = Math.max(1, Math.floor(rest.length / Math.max(1, max - first.length)));
    const pick = [...first, ...rest.filter((_, k) => k % step === 0)].slice(0, max);
    let done = 0;
    let drawn = 0;
    await fetchSkeletons(
      pick.map((i) => ids[i]),
      (k, seg) => {
        done++;
        onProgress(done, pick.length);
        if (!seg) return;
        const P = new Float32Array(seg.length);
        for (let j = 0; j < seg.length; j += 3) {
          const v = this.local(seg[j], seg[j + 1], seg[j + 2]);
          P.set([v.x, v.y, v.z], j);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(P, 3));
        const base = new THREE.Color(CLASS_COLOR[classes[cls[pick[k]]]] ?? CLASS_COLOR.other);
        const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: base.clone(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        this.scene.add(line);
        this.skeletons.push({ idx: pick[k], line, base });
        drawn++;
      },
    );
    return drawn;
  }

  hideShapes() {
    for (const s of this.skeletons) {
      this.scene.remove(s.line);
      s.line.geometry.dispose();
      (s.line.material as THREE.Material).dispose();
    }
    this.skeletons = [];
  }

  render(dtMs: number, spin: boolean) {
    const a = this.act.array as Float32Array;
    const ca = this.calc.array as Float32Array;
    const src = this.o.bus.activity;
    const decay = Math.exp(-dtMs / 140);
    const ind = INDICATORS[this.indicator];
    const kr = Math.exp(-dtMs / ind.riseMs), kd = Math.exp(-dtMs / ind.decayMs);
    for (let i = 0; i < a.length; i++) {
      const s = src[i];
      src[i] = 0;
      a[i] = Math.max(a[i] * decay, Math.min(1, s));
      // indicator kinetics: both states jump with each spike, then relax
      this.xr[i] = this.xr[i] * kr + s;
      this.xd[i] = this.xd[i] * kd + s;
      const f = Math.max(0, this.xd[i] - this.xr[i]);
      // saturation and photon shot noise
      this.rnd = (this.rnd * 1664525 + 1013904223) >>> 0;
      const noise = ((this.rnd / 4294967296) - 0.5) * 0.08;
      ca[i] = Math.min(1, Math.max(0, f / (f + 2.5) + noise));
    }
    this.act.needsUpdate = true;
    this.calc.needsUpdate = true;
    for (const s of this.skeletons) {
      const v = this.mode === "calcium" ? ca[s.idx] : a[s.idx];
      const m = s.line.material as THREE.LineBasicMaterial;
      if (this.mode === "calcium") m.color.setRGB(0.08 + 0.5 * v, 0.2 + 0.8 * v, 0.1 + 0.35 * v);
      else m.color.copy(s.base).lerp(new THREE.Color(1, 0.97, 0.9), v * 0.8);
      m.opacity = 0.35 + 0.6 * v;
    }
    if (spin) this.angle += dtMs * 0.00012;
    const d = this.radius * 3.3;
    (this.points.material as THREE.ShaderMaterial).uniforms.dist.value = d;
    this.camera.position.set(Math.sin(this.angle) * d, this.radius * 0.35, Math.cos(this.angle) * d);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.near = this.radius * 0.1;
    this.camera.far = this.radius * 20;
    this.camera.updateProjectionMatrix();
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = Math.max(0.6, h / 260);
  }

  dispose() {
    this.hideShapes();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    this.renderer.dispose();
  }
}

export class FlyView {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private renderer: THREE.WebGLRenderer;
  private fly: FlyModel;
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.6));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.2);
    key.position.set(2, 3, 2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc7ff, 1.2);
    rim.position.set(-3, 1, -2);
    this.scene.add(rim);
    this.fly = makeFly();
    this.scene.add(this.fly);
    this.camera.position.set(1.9, 2.1, 2.6);
    this.camera.lookAt(-0.08, 0.28, 0);
  }

  /** turn: -1 left to 1 right; flap and walk 0 to 1. */
  render(dtMs: number, opts: { turn: number; flap: number; walk: number; spin: boolean }) {
    this.t += dtMs / 1000;
    this.fly.rotation.y = (opts.spin ? this.t * 0.35 : 0.7) - opts.turn * 0.5;
    this.fly.rotation.x = opts.turn * 0.15;
    animateFly(this.fly, this.t, { flap: opts.flap, walk: opts.walk });
    this.renderer.render(this.scene, this.camera);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.renderer.dispose();
  }
}
