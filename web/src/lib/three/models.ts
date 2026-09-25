// Procedural 3D models: a fruit fly, a small hatchback, and city props.
// Everything is built from primitives in code; no external assets.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/* ------------------------------------------------------------------ */
/* Fruit fly                                                           */
/* ------------------------------------------------------------------ */

export type FlyModel = THREE.Group & {
  userData: { wings: THREE.Object3D[]; legs: THREE.Object3D[][] };
};

/** A Drosophila about 1 unit long, facing +x, standing on y = 0. */
export function makeFly(): FlyModel {
  const fly = new THREE.Group() as FlyModel;
  const tan = new THREE.MeshStandardMaterial({ color: 0xc49a5c, roughness: 0.5, metalness: 0.05 });
  const thoraxMat = new THREE.MeshStandardMaterial({ color: 0x8e6a3f, roughness: 0.65 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6 });
  const eye = new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.35, metalness: 0.1, emissive: 0x2a0503 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7 });
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe8ee, transparent: true, opacity: 0.38, roughness: 0.15, metalness: 0, side: THREE.DoubleSide,
    iridescence: 0.6, iridescenceIOR: 1.3, depthWrite: false,
  });

  const body = new THREE.Group();
  body.position.y = 0.32;
  fly.add(body);

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), thoraxMat);
  thorax.scale.set(1.15, 0.9, 0.85);
  body.add(thorax);

  // abdomen with dark bands
  const abdomen = new THREE.Group();
  abdomen.position.set(-0.36, -0.02, 0);
  body.add(abdomen);
  const abd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), tan);
  abd.scale.set(1.5, 0.82, 0.85);
  abdomen.add(abd);
  for (let k = 0; k < 4; k++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17 - k * 0.025, 0.028, 8, 24), dark);
    band.rotation.y = Math.PI / 2;
    band.position.x = -0.02 - k * 0.075;
    band.scale.set(1, 0.95 - k * 0.08, 1 - k * 0.06);
    abdomen.add(band);
  }

  const head = new THREE.Group();
  head.position.set(0.27, 0.03, 0);
  body.add(head);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), tan);
  headM.scale.set(0.8, 1, 1.15);
  head.add(headM);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), eye);
    e.position.set(0.03, 0.02, s * 0.1);
    e.scale.set(0.8, 1.1, 0.7);
    head.add(e);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.08, 6), dark);
    antenna.position.set(0.1, 0.06, s * 0.035);
    antenna.rotation.z = -0.6;
    head.add(antenna);
  }

  // wings: pivot at the thorax, blade extends backwards
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(-0.1, 0.1, -0.55, 0.13, -0.66, 0.02);
  wingShape.bezierCurveTo(-0.6, -0.07, -0.2, -0.07, 0, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 16);
  wingGeo.rotateX(-Math.PI / 2);
  const wings: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.02, 0.15, s * 0.1);
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.scale.z = s;
    w.rotation.y = s * 0.45;
    pivot.add(w);
    body.add(pivot);
    wings.push(pivot);
  }

  // legs: three pairs, two segments each, pivot at the thorax
  const legs: THREE.Object3D[][] = [];
  const seg = new THREE.CylinderGeometry(0.012, 0.016, 1, 6);
  seg.translate(0, -0.5, 0);
  for (const [k, x] of [0.12, 0.0, -0.1].entries()) {
    const pair: THREE.Object3D[] = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(x, -0.1, s * 0.09);
      const upper = new THREE.Mesh(seg, leg);
      upper.scale.set(1, 0.2, 1);
      hip.rotation.x = s * 1.0;
      hip.rotation.z = (k - 1) * 0.5;
      const knee = new THREE.Group();
      knee.position.y = -0.2;
      knee.rotation.x = -s * 1.35;
      const lower = new THREE.Mesh(seg, leg);
      lower.scale.set(0.85, 0.22, 0.85);
      knee.add(lower);
      upper.add(knee);
      hip.add(upper);
      body.add(hip);
      pair.push(hip);
    }
    legs.push(pair);
  }
  fly.userData = { wings, legs };
  fly.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== undefined) (o as THREE.Mesh).castShadow = true;
  });
  return fly;
}

/** Flap wings (rate 0 folds them) and step legs (walk 0 stands still). */
export function animateFly(fly: FlyModel, tSec: number, opts: { flap: number; walk: number }) {
  const { wings, legs } = fly.userData;
  const flapping = opts.flap > 0.02;
  wings.forEach((w, i) => {
    const s = i === 0 ? -1 : 1;
    if (flapping) {
      const ph = Math.sin(tSec * Math.PI * 2 * (6 + 18 * opts.flap));
      w.rotation.x = s * (0.2 + 0.9 * ph);
      w.rotation.y = s * (0.1 + 0.35 * opts.flap);
    } else {
      // folded over the back, slightly apart as in a resting fly
      w.rotation.x = s * 0.08;
      w.rotation.y = s * 0.12;
    }
  });
  legs.forEach((pair, k) =>
    pair.forEach((hip, i) => {
      const s = i === 0 ? -1 : 1;
      const phase = (k + i) % 2 === 0 ? 0 : Math.PI;
      hip.rotation.z = (k - 1) * 0.5 + Math.sin(tSec * 14 + phase) * 0.35 * opts.walk;
      hip.rotation.x = s * (1.0 + (flapping ? 0.25 : 0));
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Car                                                                 */
/* ------------------------------------------------------------------ */

export type CarModel = THREE.Group & { userData: { frontWheels: THREE.Object3D[]; wheels: THREE.Object3D[] } };

/** A small rounded hatchback about 1 unit long, facing +x, on y = 0. */
export function makeCar(color: number, roof = 0xf1f1ec): CarModel {
  const car = new THREE.Group() as CarModel;
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.15 });
  const roofMat = new THREE.MeshPhysicalMaterial({ color: roof, roughness: 0.35, metalness: 0.3, clearcoat: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x5d7488, roughness: 0.06, metalness: 0.5, clearcoat: 1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.7 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.2, metalness: 1 });
  const lampF = new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xfff2c8, emissiveIntensity: 0.8 });
  const lampR = new THREE.MeshStandardMaterial({ color: 0xa3131b, emissive: 0x7a0a10, emissiveIntensity: 0.6 });

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.26, 0.5, 4, 0.08), paint);
  body.position.y = 0.23;
  car.add(body);
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.17, 0.44, 4, 0.06), glass);
  cabin.position.set(-0.06, 0.42, 0);
  car.add(cabin);
  const roofM = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.045, 0.47, 3, 0.02), roofMat);
  roofM.position.set(-0.07, 0.515, 0);
  car.add(roofM);
  // pillars in body colour so the glass reads as windows
  for (const x of [0.2, -0.33]) {
    for (const z of [-0.215, 0.215]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.17, 0.035), roofMat);
      pillar.position.set(x, 0.42, z);
      car.add(pillar);
    }
  }
  const bumperF = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.5, 2, 0.02), trim);
  bumperF.position.set(0.5, 0.13, 0);
  car.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.x = -0.5;
  car.add(bumperR);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.22), chrome);
  grille.position.set(0.505, 0.24, 0);
  car.add(grille);
  for (const z of [-0.17, 0.17]) {
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), lampF);
    hl.position.set(0.502, 0.27, z);
    hl.rotation.y = Math.PI / 2;
    car.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.08), lampR);
    tl.position.set(-0.503, 0.28, z);
    car.add(tl);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.06), roofMat);
    mirror.position.set(0.2, 0.38, z * 1.6);
    car.add(mirror);
  }
  // racing stripe on the bonnet
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.004, 0.07), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 }));
  stripe.position.set(0.3, 0.363, 0);
  car.add(stripe);

  const tyre = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 });
  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];
  for (const x of [0.32, -0.32]) {
    for (const z of [-0.25, 0.25]) {
      const steer = new THREE.Group();
      steer.position.set(x, 0.1, z);
      const spin = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), tyre);
      t.rotation.x = Math.PI / 2;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.085, 12), rim);
      r.rotation.x = Math.PI / 2;
      spin.add(t, r);
      steer.add(spin);
      car.add(steer);
      wheels.push(spin);
      if (x > 0) frontWheels.push(steer);
    }
  }
  car.userData = { frontWheels, wheels };
  car.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return car;
}

/* ------------------------------------------------------------------ */
/* City props                                                          */
/* ------------------------------------------------------------------ */

export function windowTexture(seed: number, warm = false) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = warm ? "#d9d2c3" : "#cfd3d4";
  g.fillRect(0, 0, 64, 128);
  let a = seed >>> 0;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let y = 6; y < 124; y += 12) {
    for (let x = 5; x < 60; x += 14) {
      const lit = rnd();
      g.fillStyle = lit > 0.85 ? "#f3e2b0" : lit > 0.5 ? "#6f7a82" : "#556067";
      g.fillRect(x, y, 9, 7);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x5b4332, roughness: 0.9 }));
  trunk.position.y = 0.35;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0x4f7d3d, roughness: 0.85, flatShading: true }));
  leaves.position.y = 1.0;
  leaves.scale.set(1, 1.15, 1);
  g.add(trunk, leaves);
  g.scale.setScalar(scale);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return g;
}

/** Deterministic random numbers for scene layout. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
