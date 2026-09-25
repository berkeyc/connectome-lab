// Real FlyWire neuron shapes. Skeletons of the v783 proofread neurons are
// published by the Cambridge fly connectome group (the same source fafbseg's
// get_skeletons uses) in Neuroglancer's precomputed skeleton format:
//   uint32 vertexCount, uint32 edgeCount, float32 xyz[vertexCount] (nm),
//   uint32 edges[edgeCount][2], then per-vertex attributes (radius).
// Fetched on demand in the visitor's browser and cached for the session.

export const SKELETON_SOURCE = "https://flyem.mrc-lmb.cam.ac.uk/flyconnectome/flywire_skeletons_783";
export const SKELETON_CREDIT = "Skeletons: FlyWire v783 (Dorkenwald et al. 2024, Schlegel et al. 2024), served by the MRC LMB fly connectome group.";

/** Line segment endpoints in micrometres: [x1,y1,z1,x2,y2,z2, ...] */
export type Skeleton = Float32Array;

const cache = new Map<string, Promise<Skeleton | null>>();
const MAX_BYTES = 4_000_000;

function parse(buf: ArrayBuffer): Skeleton | null {
  if (buf.byteLength < 8) return null;
  const head = new Uint32Array(buf, 0, 2);
  const nv = head[0], ne = head[1];
  const need = 8 + nv * 12 + ne * 8;
  if (nv === 0 || ne === 0 || nv > 500_000 || ne > 500_000 || buf.byteLength < need) return null;
  const v = new Float32Array(buf, 8, nv * 3);
  const e = new Uint32Array(buf, 8 + nv * 12, ne * 2);
  const out = new Float32Array(ne * 6);
  for (let k = 0; k < ne; k++) {
    const a = e[2 * k], b = e[2 * k + 1];
    if (a >= nv || b >= nv) return null;
    out.set([v[3 * a] / 1000, v[3 * a + 1] / 1000, v[3 * a + 2] / 1000, v[3 * b] / 1000, v[3 * b + 1] / 1000, v[3 * b + 2] / 1000], 6 * k);
  }
  return out;
}

export function fetchSkeleton(rootId: string): Promise<Skeleton | null> {
  // root ids are 18 digit integers; anything else is never sent anywhere
  if (!/^\d{15,20}$/.test(rootId)) return Promise.resolve(null);
  let p = cache.get(rootId);
  if (!p) {
    p = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const r = await fetch(`${SKELETON_SOURCE}/${rootId}`, { signal: ctrl.signal, credentials: "omit", referrerPolicy: "no-referrer" });
        if (!r.ok) return null;
        const len = Number(r.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES) return null;
        const buf = await r.arrayBuffer();
        return buf.byteLength > MAX_BYTES ? null : parse(buf);
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    cache.set(rootId, p);
  }
  return p;
}

/** Fetch many skeletons, four at a time, reporting progress. */
export async function fetchSkeletons(ids: string[], onEach: (i: number, s: Skeleton | null) => void) {
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      onEach(i, await fetchSkeleton(ids[i]));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
