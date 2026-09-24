// Turns a species graph into simulation ready arrays, applies lesions and
// builds control brains (rewired or sign shuffled) for fair comparisons.

import type { BrainVariant, Graph, Target } from "./types";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIDE_CODE = { left: 0, right: 1, center: 2 } as const;

/** Indices of neurons matching any of the targets. */
export function selectNeurons(g: Graph, targets: Target[]): number[] {
  if (!targets.length) return [];
  const wanted = targets.map((t) => ({
    type: g.types.indexOf(t.cell_type),
    side: t.side ? SIDE_CODE[t.side] : -1,
  }));
  const out: number[] = [];
  for (let i = 0; i < g.type.length; i++) {
    for (const w of wanted) {
      if (w.type === g.type[i] && (w.side < 0 || w.side === g.side[i])) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

export type EdgeList = { pre: Int32Array; post: Int32Array; w: Float32Array };

/** Compressed sparse rows by presynaptic neuron, for fast spike delivery. */
export type Csr = { start: Int32Array; post: Int32Array; w: Float32Array };

export function toCsr(n: number, e: EdgeList): Csr {
  const count = new Int32Array(n + 1);
  for (let k = 0; k < e.pre.length; k++) count[e.pre[k] + 1]++;
  for (let i = 0; i < n; i++) count[i + 1] += count[i];
  const start = count.slice();
  const fill = count.slice();
  const post = new Int32Array(e.pre.length);
  const w = new Float32Array(e.pre.length);
  for (let k = 0; k < e.pre.length; k++) {
    const at = fill[e.pre[k]]++;
    post[at] = e.post[k];
    w[at] = e.w[k];
  }
  return { start, post, w };
}

/** Per neuron sign from the transmitter, following Dale's law. */
export function neuronSigns(g: Graph, sign: Record<string, number>): Int8Array {
  const s = new Int8Array(g.nt.length);
  for (let i = 0; i < g.nt.length; i++) s[i] = sign[g.nts[g.nt[i]] ?? ""] ?? 0;
  return s;
}

function shuffle<T>(arr: T[] | Int8Array | Float32Array, rnd: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/**
 * Degree preserving rewiring: repeated double edge swaps keep every neuron's
 * number of inputs and outputs but scramble who connects to whom.
 */
function rewireDegree(n: number, e: EdgeList, rnd: () => number, swapsPerEdge = 5): EdgeList {
  const pre = e.pre.slice();
  const post = e.post.slice();
  const m = pre.length;
  const key = (a: number, b: number) => a * n + b;
  const present = new Set<number>();
  for (let k = 0; k < m; k++) present.add(key(pre[k], post[k]));
  const attempts = m * swapsPerEdge;
  for (let t = 0; t < attempts; t++) {
    const x = Math.floor(rnd() * m);
    const y = Math.floor(rnd() * m);
    const a = pre[x], b = post[x], c = pre[y], d = post[y];
    if (x === y || a === d || c === b) continue;
    if (present.has(key(a, d)) || present.has(key(c, b))) continue;
    present.delete(key(a, b));
    present.delete(key(c, d));
    present.add(key(a, d));
    present.add(key(c, b));
    post[x] = d;
    post[y] = b;
  }
  return { pre, post, w: e.w.slice() };
}

/** Erdős–Rényi style control: same number of edges and weights, random endpoints. */
function rewireRandom(n: number, e: EdgeList, rnd: () => number): EdgeList {
  const m = e.pre.length;
  const pre = new Int32Array(m);
  const post = new Int32Array(m);
  const present = new Set<number>();
  let k = 0;
  while (k < m) {
    const a = Math.floor(rnd() * n);
    const b = Math.floor(rnd() * n);
    if (a === b || present.has(a * n + b)) continue;
    present.add(a * n + b);
    pre[k] = a;
    post[k] = b;
    k++;
  }
  const w = e.w.slice();
  shuffle(w, rnd);
  return { pre, post, w };
}

export type Network = {
  n: number;
  chem: Csr; // weights already signed and scaled to mV
  gapPre: Int32Array;
  gapPost: Int32Array;
  gapW: Float32Array;
  silenced: Uint8Array;
};

export function buildNetwork(
  g: Graph,
  sign: Record<string, number>,
  wSynMv: number,
  lesion: Target[],
  brain: BrainVariant,
  seed: number,
): Network {
  const n = g.neuronIds.length;
  const rnd = mulberry32(seed * 7919 + 17);
  let signs = neuronSigns(g, sign);
  let chem: EdgeList = {
    pre: Int32Array.from(g.chem.pre),
    post: Int32Array.from(g.chem.post),
    w: Float32Array.from(g.chem.w),
  };
  if (brain === "degree") chem = rewireDegree(n, chem, rnd);
  if (brain === "random") chem = rewireRandom(n, chem, rnd);
  if (brain === "signs") {
    signs = signs.slice();
    shuffle(signs, rnd);
  }
  const w = new Float32Array(chem.w.length);
  for (let k = 0; k < w.length; k++) w[k] = chem.w[k] * signs[chem.pre[k]] * wSynMv;

  const silenced = new Uint8Array(n);
  for (const i of selectNeurons(g, lesion)) silenced[i] = 1;

  return {
    n,
    chem: toCsr(n, { pre: chem.pre, post: chem.post, w }),
    gapPre: Int32Array.from(g.gap.pre),
    gapPost: Int32Array.from(g.gap.post),
    gapW: Float32Array.from(g.gap.w),
    silenced,
  };
}
