// Two reflexes of the real circuit, with no training at all.
//
// Feeding: when the fly's labellum touches a drop, sugar drives the sugar
// sensing gustatory neurons and bitter the bitter sensing ones. If MN9, the
// motor neuron of the proboscis, fires, the fly extends its proboscis and
// drinks. In the whole brain model this is the headline result of Shiu et al.
// (2024): sugar activates MN9 and bitter suppresses it.
//
// Backing away: a wall ahead expands on the retina and drives LC16. If the
// moonwalker neurons (MDN) fire, the fly walks backwards and turns away.
// LC16 activation makes real flies walk backwards (Wu et al. 2016).

import type { Metric, SenseInput, Theme, World } from "../experiments/types";
import { clamp, mulberry, wrapAngle } from "../experiments/types";
import type { GymProp, GymSnap } from "../three/snap";
import { drawGym, metric, SENSE } from "./common";

/* ------------------------------------------------------------------ */
/* Feeding                                                              */
/* ------------------------------------------------------------------ */

type Drop = { id: number; x: number; z: number; taste: "sugar" | "bitter" | "water" | "mixed"; left: number; tasted: number };

const PLATE = 4.2;
const EXTEND_HZ = 40;
const TASTE_COLOR = { sugar: "#f1d38a", bitter: "#d96a5b", water: "#9cc6e8", mixed: "#e59a6a" };

export class FeedingWorld implements World {
  timeMs = 0;
  private rnd: () => number;
  private drops: Drop[] = [];
  private fly = { x: 0, z: 0, h: 0 };
  private proboscis = 0;
  private mn9 = 0;
  private on: Drop | null = null;
  private onSince = 0;
  private events: string[] = [];
  private stats = { sugar: 0, bitter: 0, water: 0, mixed: 0, drank: 0 };
  private extensions = { sugar: 0, bitter: 0, water: 0, mixed: 0 };
  private nextId = 0;
  private extended = false;

  constructor(seed: number) {
    this.rnd = mulberry(seed * 71 + 3);
    const tastes: Drop["taste"][] = ["sugar", "sugar", "sugar", "bitter", "bitter", "water", "water", "mixed"];
    for (const t of tastes) this.spawn(t);
    this.fly.h = this.rnd() * Math.PI * 2;
  }

  private spawn(taste: Drop["taste"]) {
    for (let tries = 0; tries < 40; tries++) {
      const a = this.rnd() * Math.PI * 2, r = 0.8 + this.rnd() * (PLATE - 1.4);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.drops.every((d) => Math.hypot(d.x - x, d.z - z) > 1)) {
        this.drops.push({ id: this.nextId++, x, z, taste, left: 1, tasted: -1e9 });
        return;
      }
    }
  }

  private head() {
    return { x: this.fly.x + Math.cos(this.fly.h) * 0.45, z: this.fly.z + Math.sin(this.fly.h) * 0.45 };
  }

  sense(): SenseInput[] {
    if (!this.on) return [];
    const t = this.on.taste;
    const out: SenseInput[] = [];
    if (t === "sugar" || t === "mixed") out.push({ targets: SENSE.sugar, hz: 150 });
    if (t === "bitter" || t === "mixed") out.push({ targets: SENSE.bitter, hz: 150 });
    return out;
  }

  act(rates: Record<string, number>, dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    this.mn9 = rates.mn9 ?? 0;
    const want = this.mn9 > EXTEND_HZ ? 1 : 0;
    this.proboscis += (want - this.proboscis) * (1 - Math.exp(-dt / 0.08));
    const out = this.proboscis > 0.5;
    if (out && !this.extended && this.on) {
      this.extensions[this.on.taste]++;
      this.events.push(`MN9 fires (${this.mn9.toFixed(0)} Hz): proboscis out on ${this.on.taste === "mixed" ? "sugar with bitter" : this.on.taste}`);
    }
    this.extended = out;
    if (this.on) {
      // drinking empties the drop; without the proboscis the fly moves on after a moment
      if (out) {
        this.on.left -= dt / 1.4;
        if (this.on.left <= 0) {
          this.stats[this.on.taste]++;
          this.stats.drank++;
          this.events.push(`Drank a drop of ${this.on.taste === "mixed" ? "sugar with bitter" : this.on.taste}`);
          const t = this.on.taste;
          this.drops = this.drops.filter((d) => d !== this.on);
          this.on = null;
          this.spawn(t);
        }
      } else if (this.timeMs - this.onSince > 700) {
        this.events.push(`Tasted ${this.on.taste === "mixed" ? "sugar with bitter" : this.on.taste}, MN9 ${this.mn9.toFixed(0)} Hz: walks on`);
        this.on.tasted = this.timeMs;
        this.on = null;
        this.fly.h += Math.PI * (0.6 + 0.6 * this.rnd());
      }
      return;
    }
    // walking: a gentle search towards the nearest drop not tasted recently (smell guides it)
    const fresh = this.drops.filter((d) => this.timeMs - d.tasted > 6000);
    const hd = this.head();
    let target = fresh[0];
    for (const d of fresh) if (Math.hypot(d.x - hd.x, d.z - hd.z) < Math.hypot(target.x - hd.x, target.z - hd.z)) target = d;
    if (target) {
      const want = Math.atan2(target.z - this.fly.z, target.x - this.fly.x);
      this.fly.h += clamp(wrapAngle(want - this.fly.h), -2.5 * dt, 2.5 * dt) + (this.rnd() - 0.5) * 0.6 * dt;
    }
    const speed = 1.1;
    this.fly.x += Math.cos(this.fly.h) * speed * dt;
    this.fly.z += Math.sin(this.fly.h) * speed * dt;
    const r = Math.hypot(this.fly.x, this.fly.z);
    if (r > PLATE - 0.5) {
      this.fly.x *= (PLATE - 0.5) / r;
      this.fly.z *= (PLATE - 0.5) / r;
      this.fly.h += Math.PI / 2;
    }
    const h2 = this.head();
    const hit = this.drops.find((d) => Math.hypot(d.x - h2.x, d.z - h2.z) < 0.3 && this.timeMs - d.tasted > 6000);
    if (hit) {
      this.on = hit;
      this.onSince = this.timeMs;
    }
  }

  metrics(): Metric[] {
    return [
      metric("Sugar drops drunk", String(this.stats.sugar)),
      metric("Bitter drops drunk", String(this.stats.bitter)),
      metric("Sugar with bitter drunk", String(this.stats.mixed)),
      metric("Proboscis out on water", String(this.extensions.water)),
      metric("MN9", `${this.mn9.toFixed(0)} Hz`),
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    const props: GymProp[] = [{ id: "plate", kind: "cylinder", x: 0, y: -0.02, z: 0, sx: PLATE, sy: 0.04, color: "#1b2026" }];
    for (const d of this.drops)
      props.push({ id: `drop${d.id}`, kind: "sphere", x: d.x, y: 0.02, z: d.z, sx: 0.22 * (0.4 + 0.6 * d.left), sy: 0.08, color: TASTE_COLOR[d.taste], opacity: 0.85, glow: d.taste === "sugar" ? 0.15 : 0 });
    return {
      kind: "gym",
      task: "feeding",
      fly: { x: this.fly.x, y: 0, z: this.fly.z, h: this.fly.h, flap: 0, walk: this.on ? 0 : 0.8, proboscis: this.proboscis },
      props,
      view: { mode: "follow", dist: 2.6, height: 1.7 },
      bounds: [-PLATE, -PLATE, PLATE, PLATE],
      hud: { left: `MN9 ${this.mn9.toFixed(0)} Hz`, right: this.on ? `tasting ${this.on.taste === "mixed" ? "sugar with bitter" : this.on.taste}` : "" },
      signal: this.proboscis > 0.5 ? "drinking" : this.on ? "tasting" : "searching",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}

/* ------------------------------------------------------------------ */
/* Backing away from a wall                                             */
/* ------------------------------------------------------------------ */

const ROOM = 4.5;
const BACK_HZ = 40;

export class BackAwayWorld implements World {
  timeMs = 0;
  private rnd: () => number;
  private fly = { x: 0, z: 0, h: 0, v: 1 };
  private mdn = 0;
  private lastSize = 0;
  private size = 0;
  private backing = 0; // ms left
  private turning = 0;
  private events: string[] = [];
  private backs = 0;
  private falseBacks = 0;
  private bumps = 0;
  private cool = 0;

  constructor(seed: number) {
    this.rnd = mulberry(seed * 83 + 1);
    this.fly.h = this.rnd() * Math.PI * 2;
  }

  /** Distance to the wall straight ahead in the square room. */
  private ahead() {
    const c = Math.cos(this.fly.h), s = Math.sin(this.fly.h);
    const tx = c > 0 ? (ROOM - this.fly.x) / c : c < 0 ? (-ROOM - this.fly.x) / c : Infinity;
    const tz = s > 0 ? (ROOM - this.fly.z) / s : s < 0 ? (-ROOM - this.fly.z) / s : Infinity;
    return Math.min(tx, tz);
  }

  sense(): SenseInput[] {
    const d = Math.max(0.05, this.ahead());
    this.size = 2 * Math.atan(0.9 / d);
    const growth = Math.max(0, this.size - this.lastSize);
    const hz = clamp(this.size * 90 + growth * 1500, 0, 170);
    return hz > 20 && this.backing <= 0 ? [{ targets: SENSE.lc16, hz }] : [];
  }

  act(rates: Record<string, number>, dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    this.lastSize = this.size;
    this.mdn = rates.mdn ?? 0;
    this.cool -= dtMs;
    if (this.backing <= 0 && this.turning <= 0 && this.mdn > BACK_HZ && this.cool <= 0) {
      this.backing = 700;
      this.backs++;
      if (this.ahead() > 3) this.falseBacks++;
      this.events.push(`MDN fires (${this.mdn.toFixed(0)} Hz): walks backwards, ${this.ahead().toFixed(1)} lengths from the wall`);
    }
    if (this.backing > 0) {
      this.backing -= dtMs;
      this.fly.v = -0.9;
      if (this.backing <= 0) this.turning = 500 + this.rnd() * 400;
    } else if (this.turning > 0) {
      this.turning -= dtMs;
      this.fly.v = 0.2;
      this.fly.h += 3 * dt;
      if (this.turning <= 0) this.cool = 400;
    } else this.fly.v = 1.2;
    const nx = this.fly.x + Math.cos(this.fly.h) * this.fly.v * dt, nz = this.fly.z + Math.sin(this.fly.h) * this.fly.v * dt;
    if (Math.abs(nx) > ROOM - 0.35 || Math.abs(nz) > ROOM - 0.35) {
      if (this.fly.v > 0 && this.turning <= 0) {
        this.bumps++;
        this.events.push("Bumped into the wall");
        this.turning = 700;
      }
    } else {
      this.fly.x = nx;
      this.fly.z = nz;
    }
  }

  metrics(): Metric[] {
    return [
      metric("Backed away", String(this.backs)),
      metric("Backed away with no wall near", String(this.falseBacks)),
      metric("Bumped into the wall", String(this.bumps)),
      metric("MDN", `${this.mdn.toFixed(0)} Hz`),
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    const wall = "#3a4652";
    const props: GymProp[] = [
      { id: "w-n", kind: "box", x: 0, y: 0.4, z: ROOM + 0.1, sx: 2 * ROOM + 0.4, sy: 0.8, sz: 0.2, color: wall },
      { id: "w-s", kind: "box", x: 0, y: 0.4, z: -ROOM - 0.1, sx: 2 * ROOM + 0.4, sy: 0.8, sz: 0.2, color: wall },
      { id: "w-e", kind: "box", x: ROOM + 0.1, y: 0.4, z: 0, sx: 0.2, sy: 0.8, sz: 2 * ROOM, color: wall },
      { id: "w-w", kind: "box", x: -ROOM - 0.1, y: 0.4, z: 0, sx: 0.2, sy: 0.8, sz: 2 * ROOM, color: wall },
    ];
    return {
      kind: "gym",
      task: "backaway",
      fly: { x: this.fly.x, y: 0, z: this.fly.z, h: this.fly.h, flap: 0, walk: Math.abs(this.fly.v) > 0.3 ? 0.9 : 0.2, proboscis: 0 },
      props,
      view: { mode: "follow", dist: 3.0, height: 2.0 },
      bounds: [-ROOM, -ROOM, ROOM, ROOM],
      hud: { left: `MDN ${this.mdn.toFixed(0)} Hz`, right: `wall ${this.ahead().toFixed(1)} lengths ahead` },
      signal: this.backing > 0 ? "walking backwards" : this.turning > 0 ? "turning" : "walking",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}
