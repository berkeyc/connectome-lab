// Lighting and post processing shared by the 3D scenes.
// HDRIs: small CC0 Poly Haven environments packaged by pmndrs (@pmndrs/assets, CC0).
// Post: pmndrs/postprocessing (Zlib): SMAA, gentle bloom, AgX tone mapping, vignette.
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

export type HdriName = "park" | "city" | "apartment" | "studio" | "sunset";

const loaders: Record<HdriName, () => Promise<{ default: string }>> = {
  park: () => import("@pmndrs/assets/hdri/park.exr.js"),
  city: () => import("@pmndrs/assets/hdri/city.exr.js"),
  apartment: () => import("@pmndrs/assets/hdri/apartment.exr.js"),
  studio: () => import("@pmndrs/assets/hdri/studio.exr.js"),
  sunset: () => import("@pmndrs/assets/hdri/sunset.exr.js"),
};

/** Image based lighting from a CC0 HDRI. Parsed in memory, so no extra network access is needed. */
export async function applyHdri(renderer: THREE.WebGLRenderer, scene: THREE.Scene, name: HdriName, intensity: number) {
  const url = (await loaders[name]()).default;
  const b64 = url.slice(url.indexOf(",") + 1);
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const parsed = new EXRLoader().parse(buf.buffer);
  const tex = new THREE.DataTexture(parsed.data as ArrayBufferView as Float32Array, parsed.width, parsed.height, THREE.RGBAFormat, parsed.type);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture;
  pm.dispose();
  tex.dispose();
  const old = scene.environment;
  scene.environment = env;
  scene.environmentIntensity = intensity;
  old?.dispose();
}

export class Post {
  readonly composer: EffectComposer;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: { bloom?: number; vignette?: number } = {}) {
    // tone mapping moves from the renderer into the effect chain
    renderer.toneMapping = THREE.NoToneMapping;
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    const effects = [
      new SMAAEffect(),
      new BloomEffect({ intensity: opts.bloom ?? 0.35, luminanceThreshold: 0.9, luminanceSmoothing: 0.2, mipmapBlur: true }),
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      new VignetteEffect({ darkness: opts.vignette ?? 0.32, offset: 0.35 }),
    ];
    this.composer.addPass(new EffectPass(camera, ...effects));
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h, false);
  }

  render(dtMs: number) {
    this.composer.render(dtMs / 1000);
  }

  dispose() {
    this.composer.dispose();
  }
}
