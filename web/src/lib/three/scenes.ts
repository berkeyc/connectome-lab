// Three.js scenes for the live experiments. Each scene only draws a world's
// snapshot; the simulation itself stays in the 2D world classes and the brain
// worker. Loaded on demand (dynamic import) so pages without 3D stay light.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { animateFly, makeCar, makeFly, makeTree, rng, windowTexture, type CarModel, type FlyModel } from "./models";
import type { LoomSnap, PlateSnap, RunnerSnap, Snap, TrackSnap } from "./snap";

export type SceneKind = Snap["kind"];
export type CameraMode = "chase" | "orbit";

export interface Scene3D {
  update(snap: Snap, dtMs: number): void;
  render(): void;
  resize(w: number, h: number): void;
  setCamera(mode: CameraMode): void;
  dispose(): void;
}

function makeRenderer(canvas: HTMLCanvasElement) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  return r;
}

/** Soft studio reflections so paint, glass and water look like materials. */
function environment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, intensity = 0.55) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = intensity;
  pm.dispose();
}

function daylight(scene: THREE.Scene, sky: number, extent: number) {
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
  scene.add(sun);
  return sun;
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Race track in a small city                                          */
/* ------------------------------------------------------------------ */

type Track = TrackSnap["track"];

/** Points along the rounded rectangle centreline, with outward normals. */
function trackPath(t: Track, n = 480) {
  const hw = t.w / 2 - t.r, hh = t.h / 2 - t.r;
  const straightX = 2 * hw, straightY = 2 * hh, arc = (Math.PI / 2) * t.r;
  const total = 2 * straightX + 2 * straightY + 4 * arc;
  const pts: { p: THREE.Vector2; n: THREE.Vector2 }[] = [];
  // walk: bottom straight (y = +h/2) from +x to -x, then corners anticlockwise on screen
  const segs: ((u: number) => { p: THREE.Vector2; n: THREE.Vector2 })[] = [];
  const corner = (cx: number, cy: number, a0: number) => (u: number) => {
    const a = a0 + (u * Math.PI) / 2;
    return { p: new THREE.Vector2(cx + Math.cos(a) * t.r, cy + Math.sin(a) * t.r), n: new THREE.Vector2(Math.cos(a), Math.sin(a)) };
  };
  const line = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => (u: number) => ({
    p: new THREE.Vector2(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u),
    n: new THREE.Vector2(nx, ny),
  });
  segs.push(line(hw, t.h / 2, -hw, t.h / 2, 0, 1));
  segs.push(corner(-hw, hh, Math.PI / 2));
  segs.push(line(-t.w / 2, hh, -t.w / 2, -hh, -1, 0));
  segs.push(corner(-hw, -hh, Math.PI));
  segs.push(line(-hw, -t.h / 2, hw, -t.h / 2, 0, -1));
  segs.push(corner(hw, -hh, (3 * Math.PI) / 2));
  segs.push(line(t.w / 2, -hh, t.w / 2, hh, 1, 0));
  segs.push(corner(hw, hh, 0));
  const lens = [straightX, arc, straightY, arc, straightX, arc, straightY, arc];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * total;
    let k = 0;
    while (d > lens[k] && k < 7) d -= lens[k++];
    pts.push(segs[k](lens[k] ? d / lens[k] : 0));
  }
  return pts;
}

/** A flat band along the track between two offsets from the centreline. */
function band(path: ReturnType<typeof trackPath>, inner: number, outer: number, y: number, colors?: (i: number) => THREE.Color) {
  const n = path.length;
  const pos = new Float32Array((n + 1) * 2 * 3);
  const col = colors ? new Float32Array((n + 1) * 2 * 3) : null;
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const { p, n: nr } = path[i % n];
    const a = p.clone().addScaledVector(nr, inner), b = p.clone().addScaledVector(nr, outer);
    pos.set([a.x, y, a.y, b.x, y, b.y], i * 6);
    if (col) {
      const c = colors!(i);
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    }
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

class TrackScene implements Scene3D {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 200);
  private renderer: THREE.WebGLRenderer;
  private car: CarModel;
  private rays: THREE.Line[] = [];
  private built: string | null = null;
  private world = new THREE.Group();
  private mode: CameraMode = "chase";
  private camPos = new THREE.Vector3(0, 8, 14);
  private camLook = new THREE.Vector3();
  private sun: THREE.DirectionalLight;
  private tSec = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    environment(this.renderer, this.scene);
    this.sun = daylight(this.scene, 0xcfdde6, 22);
    this.scene.fog = new THREE.Fog(0xcfdde6, 35, 95);
    this.scene.add(this.world);
    this.car = makeCar(0x2f9e5b);
    this.scene.add(this.car);
    for (let k = 0; k < 2; k++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
      this.rays.push(l);
      this.scene.add(l);
    }
  }

  private build(t: Track) {
    const key = `${t.w}-${t.h}-${t.r}-${t.lane}`;
    if (this.built === key) return;
    this.built = key;
    for (const c of [...this.world.children]) this.world.remove(c);
    const path = trackPath(t);
    const R = rng(7);

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x86a86c, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.world.add(grass);

    // pavement ring around the track, then asphalt, lines and curbs
    const pave = new THREE.Mesh(band(path, t.lane + 0.35, t.lane + 1.6, 0.005), new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 0.95, side: THREE.DoubleSide }));
    pave.receiveShadow = true;
    this.world.add(pave);
    const asphalt = new THREE.Mesh(band(path, -t.lane, t.lane, 0.01), new THREE.MeshStandardMaterial({ color: 0x3f4246, roughness: 0.92, side: THREE.DoubleSide }));
    asphalt.receiveShadow = true;
    this.world.add(asphalt);
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f1ec, roughness: 0.6, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const edge = new THREE.Mesh(band(path, s * (t.lane - 0.12), s * (t.lane - 0.06), 0.013), white);
      this.world.add(edge);
      const curb = new THREE.Mesh(
        band(path, s * t.lane, s * (t.lane + 0.3), 0.03, (i) => new THREE.Color(Math.floor(i / 6) % 2 ? 0xe9e7e1 : 0xc33a30)),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
      );
      curb.receiveShadow = true;
      this.world.add(curb);
    }
    // dashed centre line
    const dash = new THREE.Mesh(
      band(path, -0.035, 0.035, 0.014, (i) => new THREE.Color(Math.floor(i / 5) % 2 ? 0x3f4246 : 0xe9e4c9)),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
    );
    this.world.add(dash);

    // infield: a plaza with a white sculpture, as in the city roundabouts of the driving demos
    const inner = Math.max(0.5, Math.min(t.w, t.h) / 2 - t.lane - 1.2);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(inner * 0.75, 48), new THREE.MeshStandardMaterial({ color: 0xd8d4ca, roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.012;
    plaza.receiveShadow = true;
    this.world.add(plaza);
    const sculpture = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.16, 140, 16, 2, 3), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35, metalness: 0.05 }));
    sculpture.position.y = 1.2;
    sculpture.castShadow = true;
    this.world.add(sculpture);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.35, 32), new THREE.MeshStandardMaterial({ color: 0xbdb8ad, roughness: 0.9 }));
    plinth.position.y = 0.17;
    plinth.castShadow = plinth.receiveShadow = true;
    this.world.add(plinth);
    for (let k = 0; k < 10; k++) {
      const x = (R() - 0.5) * (t.w - 2 * t.lane - 3), z = (R() - 0.5) * (t.h - 2 * t.lane - 3);
      if (Math.hypot(x, z) < inner * 0.8) continue;
      const tree = makeTree(0.7 + R() * 0.5);
      tree.position.set(x, 0, z);
      this.world.add(tree);
    }

    // city blocks around the track
    const texes = [windowTexture(3), windowTexture(11, true), windowTexture(29)];
    const mats = texes.map((map) => new THREE.MeshStandardMaterial({ map, roughness: 0.8 }));
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a9d9f, roughness: 0.9 });
    // two rows of blocks, placed outwards from the track so they never touch the road
    for (const [row, step] of [[0, 11], [1, 17]] as const) {
      for (let i = row * 5; i < path.length; i += step) {
        const { p, n } = path[i];
        const w = 2 + R() * 2.4, d = 2 + R() * 2.4, h = row ? 5 + R() * 12 : 2.5 + R() * R() * 8;
        const off = t.lane + 3.2 + d / 2 + row * 6 + R() * 1.5;
        const q = p.clone().addScaledVector(n, off);
        const k = i % texes.length;
        const m = mats[k].clone();
        m.map = texes[k].clone();
        m.map.repeat.set(Math.max(1, Math.round(w / 1.2)), Math.max(1, Math.round(h / 2.2)));
        m.map.needsUpdate = true;
        const bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [m, m, roofMat, roofMat, m, m]);
        bld.position.set(q.x, h / 2, q.y);
        bld.rotation.y = -Math.atan2(n.y, n.x);
        bld.castShadow = bld.receiveShadow = true;
        this.world.add(bld);
      }
    }
    // street trees and parked cars on the pavement ring
    for (let i = 0; i < path.length; i += 16) {
      const { p, n } = path[i];
      const tr = makeTree(0.55 + R() * 0.25);
      const q = p.clone().addScaledVector(n, t.lane + 2.1);
      tr.position.set(q.x, 0, q.y);
      this.world.add(tr);
    }
    const colors = [0x1f2a44, 0x16171a, 0xe8e8e4, 0x6b1d22, 0x2d3f55];
    for (let i = 8; i < path.length; i += 55) {
      const { p, n } = path[i];
      const c = makeCar(colors[i % colors.length], i % 2 ? 0x16171a : 0xf1f1ec);
      const q = p.clone().addScaledVector(n, t.lane + 1.1);
      c.position.set(q.x, 0, q.y);
      c.rotation.y = -Math.atan2(n.x, -n.y);
      this.world.add(c);
    }
  }

  update(s: Snap, dtMs: number) {
    if (s.kind !== "track") return;
    this.build(s.track);
    const dt = dtMs / 1000;
    this.tSec += dt;
    const { car } = s;
    this.car.position.set(car.x, 0, car.y);
    this.car.rotation.y = -car.h;
    for (const f of this.car.userData.frontWheels) f.rotation.y = -car.steer * 0.9;
    for (const w of this.car.userData.wheels) w.rotation.z -= (car.v * dt) / 0.1;
    // sensor rays at bumper height
    const origin = new THREE.Vector3(car.x + Math.cos(car.h) * 0.45, 0.25, car.y + Math.sin(car.h) * 0.45);
    [
      [-0.6, s.rays.dl, s.rays.pl],
      [0.6, s.rays.dr, s.rays.pr],
    ].forEach(([a, d, prox], k) => {
      const end = new THREE.Vector3(origin.x + Math.cos(car.h + a) * d, 0.25, origin.z + Math.sin(car.h + a) * d);
      const g = this.rays[k].geometry as THREE.BufferGeometry;
      g.setFromPoints([origin, end]);
      const m = this.rays[k].material as THREE.LineBasicMaterial;
      m.color.set(prox > 0.05 ? 0xff7a3d : 0xffffff);
      m.opacity = 0.35 + 0.65 * prox;
    });
    // camera
    const fwd = new THREE.Vector3(Math.cos(car.h), 0, Math.sin(car.h));
    let wantPos: THREE.Vector3, wantLook: THREE.Vector3;
    if (this.mode === "chase") {
      wantPos = this.car.position.clone().addScaledVector(fwd, -3.1).add(new THREE.Vector3(0, 1.45, 0));
      wantLook = this.car.position.clone().addScaledVector(fwd, 2.2).add(new THREE.Vector3(0, 0.35, 0));
    } else {
      const a = reduceMotion() ? 0.6 : this.tSec * 0.05;
      const r = Math.max(s.track.w, s.track.h) * 0.95;
      wantPos = new THREE.Vector3(Math.cos(a) * r, r * 0.75, Math.sin(a) * r);
      wantLook = new THREE.Vector3(0, 0, 0);
    }
    const k = 1 - Math.exp(-dt * 4);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // keep the shadow map centred on the car
    this.sun.position.set(car.x + 18, 30, car.y + 12);
    this.sun.target.position.set(car.x, 0, car.y);
    this.sun.target.updateMatrixWorld();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  setCamera(m: CameraMode) {
    this.mode = m;
  }
  dispose() {
    disposeScene(this.scene);
    this.renderer.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Looming escape on a table                                           */
/* ------------------------------------------------------------------ */

class LoomScene implements Scene3D {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 100);
  private renderer: THREE.WebGLRenderer;
  private fly: FlyModel;
  private ball: THREE.Mesh;
  private t = 0;
  private mode: CameraMode = "chase";

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    environment(this.renderer, this.scene);
    daylight(this.scene, 0xe9e5dc, 6);
    const wood = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.2, 64), new THREE.MeshStandardMaterial({ color: 0xb58a5c, roughness: 0.7 }));
    wood.position.y = -0.1;
    wood.receiveShadow = true;
    this.scene.add(wood);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    this.scene.add(floor);
    // a fruit bowl for scale and mood
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.4, side: THREE.DoubleSide }));
    bowl.position.set(-1.8, 0.85, -1.9);
    bowl.castShadow = true;
    this.scene.add(bowl);
    const fruitColors = [0xd9a441, 0xc2452d, 0x8fae3e];
    fruitColors.forEach((c, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
      f.position.set(-1.8 + (i - 1) * 0.35, 0.95 + (i % 2) * 0.1, -1.9 + (i - 1) * 0.12);
      f.castShadow = true;
      this.scene.add(f);
    });
    this.fly = makeFly();
    this.fly.scale.setScalar(0.55);
    this.fly.rotation.y = 0.55;
    this.scene.add(this.fly);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 32, 24), new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.45 }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
    this.camera.position.set(0, 1.4, 3.6);
    this.camera.lookAt(0, 0.35, 0);
  }

  update(s: Snap, dtMs: number) {
    if (s.kind !== "loom") return;
    const snap = s as LoomSnap;
    this.t += dtMs / 1000;
    if (snap.threat) {
      const d = snap.threat.dist;
      this.ball.visible = true;
      this.ball.position.set(snap.threat.side * (0.35 + d * 0.32), 0.9 + d * 0.12, 0.15);
    } else this.ball.visible = false;
    if (snap.jump) {
      const k = snap.jump.k;
      const lift = Math.sin(Math.min(1, k) * Math.PI) * 1.6;
      this.fly.position.set(snap.jump.dir * k * 2.4, lift, -k * 0.3);
      this.fly.rotation.z = snap.jump.dir * 0.4 * Math.sin(k * Math.PI);
      animateFly(this.fly, this.t, { flap: 1, walk: 0 });
    } else {
      this.fly.position.set(0, 0, 0);
      this.fly.rotation.z = 0;
      animateFly(this.fly, this.t, { flap: 0, walk: snap.threat ? 0 : 0.15 });
    }
    const orbit = this.mode === "orbit" && !reduceMotion();
    const a = orbit ? this.t * 0.2 : 0;
    this.camera.position.set(Math.sin(a) * 3.6, 1.4, Math.cos(a) * 3.6);
    this.camera.lookAt(0, 0.35, 0);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  setCamera(m: CameraMode) {
    this.mode = m;
  }
  dispose() {
    disposeScene(this.scene);
    this.renderer.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

function groundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b99a6e";
  g.fillRect(0, 0, 128, 128);
  const R = rng(5);
  for (let k = 0; k < 500; k++) {
    g.fillStyle = R() > 0.5 ? "rgba(90,70,45,0.25)" : "rgba(235,215,180,0.25)";
    g.fillRect(R() * 128, R() * 128, 2 + R() * 3, 2 + R() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 1);
  return t;
}

class RunnerScene implements Scene3D {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
  private renderer: THREE.WebGLRenderer;
  private fly: FlyModel;
  private tex: THREE.Texture;
  private pool: Record<string, THREE.Object3D[]> = { drop: [], stone: [], spider: [] };
  private t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    environment(this.renderer, this.scene, 0.4);
    daylight(this.scene, 0xcfe0e8, 14);
    this.scene.fog = new THREE.Fog(0xcfe0e8, 18, 60);
    this.tex = groundTexture();
    const path = new THREE.Mesh(new THREE.PlaneGeometry(60, 2.4), new THREE.MeshStandardMaterial({ map: this.tex, roughness: 1 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(10, 0.02, 0);
    path.receiveShadow = true;
    this.scene.add(path);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x7ea464, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);
    const R = rng(3);
    for (let k = 0; k < 40; k++) {
      const tr = makeTree(0.8 + R() * 0.9);
      tr.position.set(-10 + R() * 60, 0, (R() > 0.5 ? 1 : -1) * (3 + R() * 10));
      this.scene.add(tr);
    }
    this.fly = makeFly();
    this.fly.scale.setScalar(0.9);
    this.scene.add(this.fly);
  }

  private obstacle(kind: "drop" | "stone" | "spider", i: number) {
    const list = this.pool[kind];
    if (!list[i]) {
      let o: THREE.Object3D;
      if (kind === "drop") {
        const m = new THREE.MeshPhysicalMaterial({ color: 0x9fd3ff, roughness: 0.05, transmission: 0.6, thickness: 0.5, transparent: true, opacity: 0.85 });
        const g = new THREE.Group();
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20), m);
        s.position.y = 0.5;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.6, 32), m);
        c.position.y = 1.05;
        g.add(s, c);
        o = g;
      } else if (kind === "stone") {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95, flatShading: true }));
        s.position.y = 0.4;
        s.scale.set(1, 0.75, 0.9);
        const g = new THREE.Group();
        g.add(s);
        o = g;
      } else {
        const g = new THREE.Group();
        const black = new THREE.MeshStandardMaterial({ color: 0x1a1718, roughness: 0.6 });
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), black);
        b.position.y = 0.45;
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), black);
        h.position.set(-0.38, 0.42, 0);
        g.add(b, h);
        for (let k = 0; k < 8; k++) {
          const side = k < 4 ? -1 : 1;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.7, 6), black);
          leg.position.set(-0.25 + (k % 4) * 0.15, 0.3, side * 0.35);
          leg.rotation.x = side * 0.9;
          g.add(leg);
        }
        o = g;
      }
      o.traverse((m) => ((m as THREE.Mesh).isMesh ? ((m as THREE.Mesh).castShadow = true) : null));
      this.scene.add(o);
      list[i] = o;
    }
    return list[i];
  }

  update(s: Snap, dtMs: number) {
    if (s.kind !== "runner") return;
    const snap = s as RunnerSnap;
    this.t += dtMs / 1000;
    this.tex.offset.x = (snap.scroll / 5) % 1;
    const used: Record<string, number> = { drop: 0, stone: 0, spider: 0 };
    for (const o of snap.obstacles) {
      const m = this.obstacle(o.kind, used[o.kind]++);
      m.visible = true;
      m.position.set(o.x, 0, 0);
      m.scale.setScalar(o.w);
      if (o.kind === "stone") m.rotation.z = -o.x * 0.9;
    }
    for (const k of Object.keys(this.pool)) this.pool[k].forEach((m, i) => (m.visible = i < used[k]));
    this.fly.position.set(snap.flyX, snap.flyY, 0);
    this.fly.rotation.z = snap.flyY > 0.05 ? 0.25 : 0;
    animateFly(this.fly, this.t, { flap: snap.flyY > 0.05 ? 1 : 0, walk: snap.dead ? 0 : 1 });
    this.camera.position.set(snap.flyX + 0.7, 1.5, 5.0);
    this.camera.lookAt(snap.flyX + 1.5, 0.5, 0);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  setCamera() {}
  dispose() {
    disposeScene(this.scene);
    this.renderer.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Worm on an agar plate                                               */
/* ------------------------------------------------------------------ */

class PlateScene implements Scene3D {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.01, 50);
  private renderer: THREE.WebGLRenderer;
  private worm: THREE.Mesh;
  private trail: THREE.Line;
  private lawn: THREE.Mesh;
  private rim: THREE.Mesh;
  private t = 0;
  private mode: CameraMode = "chase";

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    environment(this.renderer, this.scene, 0.8);
    daylight(this.scene, 0x1c1f22, 2);
    this.scene.background = new THREE.Color(0x202326);
    const bench = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x2c3034, roughness: 0.8 }));
    bench.rotation.x = -Math.PI / 2;
    bench.position.y = -0.06;
    bench.receiveShadow = true;
    this.scene.add(bench);
    const agar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 96), new THREE.MeshPhysicalMaterial({ color: 0xe8c98a, roughness: 0.25, transmission: 0.2, thickness: 0.1 }));
    agar.position.y = -0.03;
    agar.receiveShadow = true;
    this.scene.add(agar);
    this.rim = new THREE.Mesh(
      new THREE.CylinderGeometry(1.04, 1.04, 0.16, 96, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    this.rim.position.y = 0.02;
    this.scene.add(this.rim);
    // bacterial lawn: a soft translucent disc
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(150,190,110,0.85)");
    grad.addColorStop(0.5, "rgba(150,190,110,0.35)");
    grad.addColorStop(1, "rgba(150,190,110,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.lawn = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.lawn.rotation.x = -Math.PI / 2;
    this.lawn.position.y = 0.003;
    this.scene.add(this.lawn);
    this.worm = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ color: 0xe9ddd0, roughness: 0.35, transmission: 0.25, thickness: 0.05, clearcoat: 0.6 }));
    this.worm.castShadow = true;
    this.scene.add(this.worm);
    this.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8a6b3c, transparent: true, opacity: 0.5 }));
    this.scene.add(this.trail);
  }

  update(s: Snap, dtMs: number) {
    if (s.kind !== "plate") return;
    const snap = s as PlateSnap;
    this.t += dtMs / 1000;
    if (snap.food) {
      this.lawn.visible = true;
      this.lawn.position.set(snap.food.x, 0.003, snap.food.y);
      this.lawn.scale.setScalar(snap.foodSigma * 4.4);
    } else this.lawn.visible = false;
    (this.rim.material as THREE.MeshPhysicalMaterial).color.set(snap.touching ? 0xffb07a : 0xffffff);
    const pts = snap.trail.map((p) => new THREE.Vector3(p.x, 0.0025, p.y));
    this.trail.geometry.dispose();
    this.trail.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    // body: the last stretch of the track, about a millimetre long
    const body: THREE.Vector3[] = [];
    let len = 0;
    const head = new THREE.Vector3(snap.head.x, 0.012, snap.head.y);
    body.push(head);
    for (let i = snap.trail.length - 1; i >= 0 && len < 0.22; i--) {
      const q = new THREE.Vector3(snap.trail[i].x, 0.012, snap.trail[i].y);
      const d = q.distanceTo(body[body.length - 1]);
      if (d < 0.004) continue;
      len += d;
      body.push(q);
    }
    if (body.length >= 3) {
      const curve = new THREE.CatmullRomCurve3(body);
      this.worm.geometry.dispose();
      const tube = new THREE.TubeGeometry(curve, 48, 0.014, 10, false);
      this.worm.geometry = tube;
    }
    const orbit = this.mode === "orbit" && !reduceMotion();
    const a = orbit ? this.t * 0.1 : 0.4;
    if (this.mode === "chase" && !orbit) {
      this.camera.position.set(snap.head.x * 0.5, 0.9, snap.head.y * 0.5 + 1.0);
      this.camera.lookAt(snap.head.x * 0.8, 0, snap.head.y * 0.8);
    } else {
      this.camera.position.set(Math.sin(a) * 1.7, 1.7, Math.cos(a) * 1.7);
      this.camera.lookAt(0, 0, 0);
    }
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }
  setCamera(m: CameraMode) {
    this.mode = m;
  }
  dispose() {
    disposeScene(this.scene);
    this.renderer.dispose();
  }
}

export function createScene(kind: SceneKind, canvas: HTMLCanvasElement): Scene3D {
  if (kind === "track") return new TrackScene(canvas);
  if (kind === "loom") return new LoomScene(canvas);
  if (kind === "runner") return new RunnerScene(canvas);
  return new PlateScene(canvas);
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
