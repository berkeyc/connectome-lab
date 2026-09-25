// Lighting, floors and post processing shared by the 3D scenes.
// HDRIs: small CC0 Poly Haven environments packaged by pmndrs (@pmndrs/assets, CC0).
// Post: pmndrs/postprocessing (Zlib): gentle bloom, AgX tone mapping, SMAA, vignette.
import { BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

export type HdriName = "park" | "city" | "apartment" | "studio" | "sunset";

const loaders: Record<HdriName, () => Promise<{ default: string }>> = {
  park: () => import("@pmndrs/assets/hdri/park.exr.js"),
  city: () => import("@pmndrs/assets/hdri/city.exr.js"),
  apartment: () => import("@pmndrs/assets/hdri/apartment.exr.js"),
  studio: () => import("@pmndrs/assets/hdri/studio.exr.js"),
  sunset: () => import("@pmndrs/assets/hdri/sunset.exr.js"),
};

type Parsed = { data: Float32Array; width: number; height: number; type: THREE.TextureDataType };
const parsed = new Map<HdriName, Promise<Parsed>>();

/** Decode each HDRI once per page; every renderer then builds its own prefiltered map. */
function decode(name: HdriName): Promise<Parsed> {
  const cached = parsed.get(name);
  if (cached) return cached;
  const p = loaders[name]().then(({ default: url }): Parsed => {
    const b64 = url.slice(url.indexOf(",") + 1);
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const r = new EXRLoader().parse(buf.buffer);
    return { data: r.data as ArrayBufferView as Float32Array, width: r.width ?? 1, height: r.height ?? 1, type: r.type ?? THREE.HalfFloatType };
  });
  p.catch(() => parsed.delete(name));
  parsed.set(name, p);
  return p;
}

/** Image based lighting from a CC0 HDRI. Parsed in memory, so no extra network access is needed. */
export async function applyHdri(renderer: THREE.WebGLRenderer, scene: THREE.Scene, name: HdriName, intensity: number) {
  const r = await decode(name);
  const tex = new THREE.DataTexture(r.data, r.width, r.height, THREE.RGBAFormat, r.type);
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

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: { bloom?: number; vignette?: number; threshold?: number } = {}) {
    // tone mapping moves from the renderer into the effect chain
    renderer.toneMapping = THREE.NoToneMapping;
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));
    // bloom works on scene light (before tone mapping); only highlights above 1 glow
    this.composer.addPass(
      new EffectPass(
        camera,
        new BloomEffect({ intensity: opts.bloom ?? 0.3, luminanceThreshold: opts.threshold ?? 1.0, luminanceSmoothing: 0.15, mipmapBlur: true, radius: 0.6 }),
        new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
        new VignetteEffect({ darkness: opts.vignette ?? 0.32, offset: 0.35 }),
      ),
    );
    // edge smoothing works best on the final, tone mapped image
    this.composer.addPass(new EffectPass(camera, new SMAAEffect()));
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

/* ------------------------------------------------------------------ */
/* Studio floor                                                        */
/* ------------------------------------------------------------------ */

export type FloorOptions = {
  size?: number;
  /** grid cell in scene units */
  cell?: number;
  /** real reflection of the scene (costs one more render); off on slow GPUs */
  reflect?: boolean;
  color?: number;
  lineColor?: number;
  /** distance over which the grid and reflection fade out */
  fade?: [number, number];
  reflectivity?: number;
};

/**
 * A dark, glossy lab floor with a fine grid, like a simulation arena. With
 * `reflect` the scene is mirrored in it (softened with a few taps), otherwise it
 * reflects only the environment. Lines are antialiased with screen derivatives
 * and fade out before they would shimmer.
 */
export function studioFloor(o: FloorOptions = {}) {
  const size = o.size ?? 40;
  const geo = new THREE.PlaneGeometry(size, size);
  let floor: THREE.Mesh;
  let rt: THREE.WebGLRenderTarget | null = null;
  let texM: THREE.Matrix4 | null = null;
  if (o.reflect) {
    const r = new Reflector(geo, { textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0 });
    const old = r.material as THREE.ShaderMaterial;
    texM = old.uniforms.textureMatrix.value as THREE.Matrix4;
    rt = r.getRenderTarget();
    old.dispose();
    floor = r;
  } else {
    floor = new THREE.Mesh(geo);
  }
  // dim environment reflection: a bright HDRI would otherwise wash the floor out at grazing angles
  // low specular: the floor should read as dark polished resin, not as a mirror of the lights
  const mat = new THREE.MeshPhysicalMaterial({ color: o.color ?? 0x0b0e12, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.2, specularIntensity: 0.18 });
  const line = new THREE.Color(o.lineColor ?? 0x4f6f8f);
  mat.onBeforeCompile = (s) => {
    s.uniforms.tR = { value: rt?.texture ?? null };
    s.uniforms.uM = { value: texM ?? new THREE.Matrix4() };
    s.uniforms.uRefl = { value: o.reflect ? (o.reflectivity ?? 0.45) : 0 };
    s.uniforms.uCell = { value: o.cell ?? 0.5 };
    s.uniforms.uFade = { value: new THREE.Vector2(...(o.fade ?? [4, 16])) };
    s.uniforms.uLine = { value: line };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uM; varying vec4 vR; varying vec3 vW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvR = uM * vec4(transformed, 1.0); vW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D tR; uniform float uRefl; uniform float uCell; uniform vec2 uFade; uniform vec3 uLine;
        varying vec4 vR; varying vec3 vW;`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          vec2 g = vW.xz / uCell;
          vec2 w = fwidth(g);
          vec2 l = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-4));
          float lineA = (1.0 - min(min(l.x, l.y), 1.0)) * (1.0 - smoothstep(0.25, 0.7, max(w.x, w.y)));
          vec2 g4 = g / 4.0; vec2 w4 = fwidth(g4);
          vec2 l4 = abs(fract(g4 - 0.5) - 0.5) / max(w4, vec2(1e-4));
          float major = (1.0 - min(min(l4.x, l4.y), 1.0)) * (1.0 - smoothstep(0.25, 0.7, max(w4.x, w4.y)));
          float fade = 1.0 - smoothstep(uFade.x, uFade.y, distance(vW.xz, cameraPosition.xz));
          float fr = 0.04 + 0.96 * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 5.0);
          if (uRefl > 0.0) {
            vec2 uv = vR.xy / vR.w;
            vec2 px = vec2(1.5 / 512.0);
            vec3 r = texture2D(tR, uv).rgb * 0.4
              + texture2D(tR, uv + vec2(px.x, 0.0)).rgb * 0.15 + texture2D(tR, uv - vec2(px.x, 0.0)).rgb * 0.15
              + texture2D(tR, uv + vec2(0.0, px.y)).rgb * 0.15 + texture2D(tR, uv - vec2(0.0, px.y)).rgb * 0.15;
            outgoingLight += r * uRefl * mix(0.35, 1.0, fr) * fade;
          }
          outgoingLight += uLine * (lineA * 0.09 + major * 0.14) * fade;
        }
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => (o.reflect ? "studio-floor-r" : "studio-floor");
  floor.material = mat;
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

/** A soft dark spot under a small object, so it sits on the floor even without a shadow map. */
export function contactShadow(radius: number, opacity = 0.55) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(0,0,0,${opacity})`);
  grad.addColorStop(0.5, `rgba(0,0,0,${opacity * 0.45})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/** Key, rim and fill lights of a photo studio, aimed at a subject near the origin. */
export function studioLights(scene: THREE.Scene, opts: { extent?: number; shadowSize?: number } = {}) {
  const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(opts.shadowSize ?? 1024, opts.shadowSize ?? 1024);
  const e = opts.extent ?? 1.5;
  const c = key.shadow.camera;
  c.left = c.bottom = -e;
  c.right = c.top = e;
  c.near = 0.5;
  c.far = 20;
  key.shadow.radius = 3;
  key.shadow.bias = -0.001;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xcfe4ff, 3.2);
  rim.position.set(-3, 2.5, -3);
  scene.add(rim);
  const fill = new THREE.HemisphereLight(0xbfd4ea, 0x0b0d10, 0.5);
  scene.add(fill);
  return { key, rim, fill };
}
