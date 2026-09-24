// Brain backends for live experiments: the in-browser worker, or a local
// runner on the user's own computer for connectomes too big for a browser.
import type { BrainVariant, Graph, SpeciesMeta, Target } from "../engine/types";
import type { Channel, SenseInput } from "./types";

export type TickResult = {
  rates: Record<string, number>;
  spikes: { t: number[]; i: number[] };
  active: number;
  computeMs?: number;
};

export type ReadyInfo = { neurons: number; cls: number[]; classes: string[]; missing?: string[]; species?: string };

export interface BrainClient {
  init(): Promise<ReadyInfo>;
  tick(inputs: SenseInput[], ms: number): Promise<TickResult>;
  close(): void;
}

type Pending = { resolve: (r: TickResult) => void; reject: (e: Error) => void };

export class WorkerBrain implements BrainClient {
  private w: Worker;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private readyResolve?: (n: number) => void;
  private readyReject?: (e: Error) => void;

  constructor(
    private graph: Graph,
    private meta: SpeciesMeta,
    private channels: Channel[],
    private opts: { brain: BrainVariant; seed: number; lesion: Target[] },
  ) {
    this.w = new Worker(new URL("./live.worker.ts", import.meta.url), { type: "module" });
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") this.readyResolve?.(m.neurons);
      else if (m.type === "tick") {
        this.pending.get(m.id)?.resolve(m);
        this.pending.delete(m.id);
      } else if (m.type === "error") {
        const err = new Error(m.message);
        this.readyReject?.(err);
        for (const p of this.pending.values()) p.reject(err);
        this.pending.clear();
      }
    };
  }

  async init(): Promise<ReadyInfo> {
    const ready = new Promise<number>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.w.postMessage({ type: "init", graph: this.graph, meta: this.meta, channels: this.channels, ...this.opts });
    const neurons = await ready;
    return { neurons, cls: this.graph.cls, classes: this.graph.classes };
  }

  tick(inputs: SenseInput[], ms: number) {
    const id = ++this.seq;
    return new Promise<TickResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.w.postMessage({ type: "tick", id, inputs, ms });
    });
  }

  close() {
    this.w.terminate();
  }
}

export const LOCAL_URL = "ws://localhost:8765";

export class LocalBrain implements BrainClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  constructor(
    private species: string,
    private channels: Channel[],
    private opts: { brain: BrainVariant; seed: number; lesion: Target[] },
    private url = LOCAL_URL,
  ) {}

  init(): Promise<ReadyInfo> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const fail = (msg: string) => {
        if (!settled) {
          settled = true;
          reject(new Error(msg));
        }
      };
      ws.onerror = () => fail(`Could not reach the local runner at ${this.url}. Is it running?`);
      ws.onclose = () => {
        fail("The local runner closed the connection.");
        for (const p of this.pending.values()) p.reject(new Error("Local runner disconnected"));
        this.pending.clear();
      };
      ws.onopen = () => ws.send(JSON.stringify({ type: "init", species: this.species, channels: this.channels, ...this.opts }));
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === "ready") {
          settled = true;
          resolve(m);
        } else if (m.type === "error") {
          fail(m.message);
        } else if (m.type === "tick") {
          this.pending.get(m.id)?.resolve(m);
          this.pending.delete(m.id);
        }
      };
    });
  }

  tick(inputs: SenseInput[], ms: number) {
    const id = ++this.seq;
    return new Promise<TickResult>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return reject(new Error("Local runner not connected"));
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: "tick", id, inputs, ms }));
    });
  }

  close() {
    this.ws?.close();
  }
}
