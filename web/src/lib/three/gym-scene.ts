// One scene for every Fly Gym task. A task describes its world as a list of
// simple props (boxes, drops, cards, flowers, other flies) in a snapshot; this
// scene turns them into meshes on the studio floor, reuses them by id from
// frame to frame, and poses the realistic fly (walking, flying, feeding).
import * as THREE from "three";
import { BaseScene, damp } from "./base";
import { FlyActor } from "./flymodel";
import { contactShadow, studioFloor, studioLights } from "./look";
import type { GymProp, GymSnap, Snap } from "./snap";

type Entry = { obj: THREE.Object3D; kind: GymProp["kind"]; mats: THREE.MeshStandardMaterial[]; key: string; fly?: FlyActor };

function cardTexture(label: string, faceUp: boolean) {
  const c = document.createElement("canvas");
  c.width = 140;
  c.height = 200;
  const g = c.getContext("2d")!;
  g.fillStyle = faceUp ? "#f4efe6" : "#27456e";
  g.fillRect(0, 0, 140, 200);
  g.strokeStyle = faceUp ? "#c9c1b2" : "#9fb6d6";
  g.lineWidth = 6;
  g.strokeRect(8, 8, 124, 184);
  if (faceUp && label) {
    g.fillStyle = label === "K" ? "#8c1f1f" : "#1d1d22";
    g.font = "700 96px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, 70, 104);
  } else if (!faceUp) {
    g.strokeStyle = "#9fb6d6";
    g.lineWidth = 3;
    for (let i = -200; i < 200; i += 18) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 200, 200);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // the top face of a box maps the image upside down for a player sitting at -z
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI;
  return t;
}

function drumMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uPhase: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uPhase; varying vec2 vUv;
      void main() {
        // 24 vertical stripes, like the drums of fly flight simulators, soft edges against aliasing
        float s = sin((vUv.x * 6.2831853 + uPhase) * 12.0);
        float w = fwidth(s);
        float stripe = smoothstep(-w, w, s);
        float edge = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        vec3 col = mix(vec3(0.02, 0.025, 0.03), vec3(0.22, 0.42, 0.3), stripe) * edge;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export class GymScene extends BaseScene {
  private flyA: FlyActor;
  private shadow: THREE.Mesh;
  private props = new Map<string, Entry>();
  private cards = new Map<string, THREE.Texture>();
  private geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 28, 18),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 48),
    disc: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
  };
  private drum: THREE.Mesh | null = null;
  private camPos = new THREE.Vector3(0, 3, -4);
  private camLook = new THREE.Vector3();
  private first = true;
  private task = "";

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 80), { hdri: "studio", env: 0.4, bloom: 0.3, threshold: 0.95 });
    this.scene.background = new THREE.Color(0x07090c);
    this.scene.fog = new THREE.Fog(0x07090c, 9, 26);
    const { key } = studioLights(this.scene, { extent: 5, shadowSize: this.tier === "high" ? 2048 : 1024 });
    key.position.set(3, 6, -2);
    key.intensity = 2.0; // cameras here often look down on the fly: a softer key keeps it from washing out
    this.scene.add(studioFloor({ size: 60, cell: 0.5, reflect: this.tier === "high", fade: [6, 18] }));
    this.shadow = contactShadow(0.6, 0.6);
    this.shadow.position.y = 0.003;
    this.scene.add(this.shadow);
    this.flyA = this.fly();
    this.scene.add(this.flyA);
  }

  private material(color: string, opacity = 1) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02, envMapIntensity: 0.6, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  }

  private create(p: GymProp): Entry {
    const color = p.color ?? "#8a96a3";
    let obj: THREE.Object3D;
    const mats: THREE.MeshStandardMaterial[] = [];
    let fly: FlyActor | undefined;
    if (p.kind === "fly") {
      fly = this.fly("low");
      obj = fly;
    } else if (p.kind === "card") {
      const side = this.material("#e9e3d7");
      const top = new THREE.MeshStandardMaterial({ roughness: 0.6 });
      mats.push(side, top);
      obj = new THREE.Mesh(this.geo.box, [side, side, top, side, side, side]);
    } else if (p.kind === "flower") {
      const g = new THREE.Group();
      const petal = this.material(color);
      const stem = this.material("#4f7a3a");
      const heart = this.material("#f7d25c");
      mats.push(petal, stem, heart);
      const s = new THREE.Mesh(this.geo.cylinder, stem);
      s.scale.set(0.04, 0.5, 0.04);
      s.position.y = 0.25;
      g.add(s);
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(this.geo.sphere, petal);
        const a = (i / 6) * Math.PI * 2;
        m.scale.set(0.35, 0.05, 0.18);
        m.position.set(Math.cos(a) * 0.32, 0.52, Math.sin(a) * 0.32);
        m.rotation.y = -a;
        g.add(m);
      }
      const c = new THREE.Mesh(this.geo.sphere, heart);
      c.scale.set(0.16, 0.08, 0.16);
      c.position.y = 0.55;
      g.add(c);
      obj = g;
    } else {
      const m = this.material(color, p.opacity ?? 1);
      mats.push(m);
      const geo = p.kind === "box" ? this.geo.box : p.kind === "cylinder" ? this.geo.cylinder : p.kind === "disc" ? this.geo.disc : this.geo.sphere;
      obj = new THREE.Mesh(geo, m);
    }
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && p.kind !== "cloud" && p.kind !== "disc") {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.scene.add(obj);
    return { obj, kind: p.kind, mats, key: "", fly };
  }

  private place(e: Entry, p: GymProp, dt: number) {
    const o = e.obj;
    o.visible = true;
    o.position.set(p.x, p.y, p.z);
    o.rotation.y = -(p.rot ?? 0);
    const sx = p.sx ?? 0.5, sy = p.sy ?? sx, sz = p.sz ?? sx;
    if (p.kind === "box" || p.kind === "card") o.scale.set(sx, sy, sz);
    else if (p.kind === "cylinder") {
      o.scale.set(sx, sy, sx);
      o.position.y = p.y + sy / 2;
    } else if (p.kind === "sphere" || p.kind === "cloud") o.scale.set(sx, sy, sx);
    else if (p.kind === "disc") o.scale.setScalar(sx);
    else if (p.kind === "flower") o.scale.setScalar(sx / 0.45);
    else if (p.kind === "fly") {
      o.scale.setScalar(sx);
      e.fly?.animate(dt, { flap: 0, walk: 0.4, proboscis: 0 });
    }
    // colours and glow change rarely: touch materials only when they do
    const key = `${p.color}|${p.label}|${p.glow ?? 0}|${p.opacity ?? 1}`;
    if (key === e.key) return;
    e.key = key;
    if (p.kind === "card") {
      const faceUp = Boolean(p.label);
      const tk = faceUp ? `up-${p.label}` : "down";
      let tex = this.cards.get(tk);
      if (!tex) {
        tex = cardTexture(p.label ?? "", faceUp);
        this.cards.set(tk, tex);
      }
      e.mats[1].map = tex;
      e.mats[1].needsUpdate = true;
      return;
    }
    const m = e.mats[0];
    if (!m) return;
    if (p.kind !== "flower") m.color.set(p.color ?? "#8a96a3");
    m.emissive.set(p.color ?? "#000000");
    m.emissiveIntensity = (p.glow ?? 0) * 1.2;
    m.opacity = p.opacity ?? 1;
  }

  update(s: Snap, dtMs: number) {
    if (s.kind !== "gym") return;
    const snap = s as GymSnap;
    const dt = dtMs / 1000;
    if (snap.task !== this.task) {
      // a different task: clear the stage
      for (const e of this.props.values()) e.obj.visible = false;
      this.task = snap.task;
      this.first = true;
    }
    const seen = new Set<string>();
    for (const p of snap.props) {
      let e = this.props.get(p.id);
      if (!e || e.kind !== p.kind) {
        if (e) this.scene.remove(e.obj);
        e = this.create(p);
        this.props.set(p.id, e);
      }
      this.place(e, p, dt);
      seen.add(p.id);
    }
    for (const [id, e] of this.props) if (!seen.has(id)) e.obj.visible = false;
    // the fly
    const f = snap.fly;
    this.flyA.position.set(f.x, f.y, f.z);
    this.flyA.rotation.set(f.roll ?? 0, -f.h, 0, "YXZ");
    this.flyA.animate(dt, { flap: f.flap, walk: f.walk, proboscis: f.proboscis });
    this.shadow.position.set(f.x, 0.003, f.z);
    this.shadow.scale.setScalar(1 + f.y * 0.6);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, 1 - f.y * 0.4);
    // flight drum
    if (snap.drum) {
      if (!this.drum) {
        this.drum = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3.2, 128, 1, true), drumMaterial());
        this.drum.position.y = 1.4;
        this.scene.add(this.drum);
      }
      this.drum.visible = true;
      (this.drum.material as THREE.ShaderMaterial).uniforms.uPhase.value = snap.drum.phase;
    } else if (this.drum) this.drum.visible = false;
    // camera
    const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
    if (snap.view.mode === "follow") {
      const fx = Math.cos(f.h), fz = Math.sin(f.h);
      wantPos.set(f.x - fx * snap.view.dist, f.y + snap.view.height, f.z - fz * snap.view.dist);
      wantLook.set(f.x + fx * 0.8, f.y + 0.2, f.z + fz * 0.8);
    } else {
      wantPos.set(...snap.view.pos);
      wantLook.set(...snap.view.look);
    }
    const k = this.first ? 1 : damp(snap.view.mode === "follow" ? 3 : 5, dt);
    this.first = false;
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  dispose() {
    for (const t of this.cards.values()) t.dispose();
    Object.values(this.geo).forEach((g) => g.dispose());
    super.dispose();
  }
}
