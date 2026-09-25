// 3D neural activity: every neuron of the circuit at its measured position
// (FlyWire coordinates), flashing when it spikes. Also a small fly panel.
import * as THREE from "three";
import { animateFly, makeFly, type FlyModel } from "./models";

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

export type SpikeBus = { n: number; activity: Float32Array };

export class BrainView {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 10000);
  private renderer: THREE.WebGLRenderer;
  private points: THREE.Points;
  private act: THREE.BufferAttribute;
  private radius: number;
  private angle = 0.6;

  constructor(canvas: HTMLCanvasElement, pos: ArrayLike<number>, cls: number[], classes: string[], private bus: SpikeBus) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const n = cls.length;
    // centre the cloud; FlyWire y grows downwards, so flip it
    const P = new Float32Array(n * 3);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      cx += pos[i * 3];
      cy += pos[i * 3 + 1];
      cz += pos[i * 3 + 2];
    }
    cx /= n;
    cy /= n;
    cz /= n;
    let r = 1;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3] - cx, y = -(pos[i * 3 + 1] - cy), z = pos[i * 3 + 2] - cz;
      P.set([x, y, z], i * 3);
      r = Math.max(r, Math.hypot(x, y, z));
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
    g.setAttribute("activity", this.act);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 1 } },
      vertexShader: `
        attribute vec3 color; attribute float activity; uniform float scale;
        varying vec3 vColor; varying float vA;
        void main() {
          vColor = color; vA = activity;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = scale * (4.5 + 9.0 * activity) * (260.0 / -mv.z) * 3.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5; float r = length(d);
          if (r > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, r);
          vec3 col = mix(vColor * 0.8, vec3(1.0, 0.97, 0.9), vA * 0.8);
          gl_FragColor = vec4(col, glow * (0.42 + 0.58 * vA));
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.scene.add(this.points);
    // faint outline of the fly brain for orientation: central brain and two optic lobes
    // (schematic shapes sized from the FlyWire extent, not a mesh of the real brain)
    const shell = new THREE.MeshBasicMaterial({ color: 0x5f7a8c, wireframe: true, transparent: true, opacity: 0.07 });
    const box = new THREE.Box3().setFromBufferAttribute(g.getAttribute("position") as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    const mid = box.getCenter(new THREE.Vector3());
    const central = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), shell);
    central.scale.set(size.x * 0.22, size.y * 0.42, Math.max(size.z * 0.45, size.x * 0.12));
    central.position.copy(mid);
    this.scene.add(central);
    for (const s of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), shell);
      lobe.scale.set(size.x * 0.14, size.y * 0.36, Math.max(size.z * 0.4, size.x * 0.1));
      lobe.position.set(mid.x + s * size.x * 0.38, mid.y, mid.z);
      this.scene.add(lobe);
    }
  }

  render(dtMs: number, spin: boolean) {
    const a = this.act.array as Float32Array;
    const decay = Math.exp(-dtMs / 140);
    const src = this.bus.activity;
    for (let i = 0; i < a.length; i++) {
      a[i] = Math.max(a[i] * decay, src[i]);
      src[i] = 0;
    }
    this.act.needsUpdate = true;
    if (spin) this.angle += dtMs * 0.00012;
    const d = this.radius * 3.3;
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
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
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
