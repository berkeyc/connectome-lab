// C. elegans on an agar plate. The head position, heading and a trail of
// past positions make up the body; the connectome decides crawl direction
// (forward and backward command interneurons) and head bending.

import { clamp, mulberry, type Metric, type SenseInput, type Theme, type World } from "./types";

type P = { x: number; y: number };

export type WormOptions = {
  food?: boolean; // add a food patch and odour gradient
  seed: number;
};

const DISH_R = 1; // world units, the canvas scales to fit
const BODY_LEN = 0.22;
const MAX_SPEED = 0.16; // per second
const NOSE_RANGE = 0.05;

export class WormWorld implements World {
  timeMs = 0;
  private head: P;
  private heading: number;
  private trail: P[] = [];
  private rnd: () => number;
  private events: string[] = [];
  private food: P | null;
  private cHistory: { t: number; c: number }[] = [];
  private touching = false;
  private reversing = false;
  private reversals = 0;
  private touches = 0;
  private direction = 0;
  private dcdt = 0;
  private phase = 0;
  private foundAt: number | null = null;
  private wander = 0;
  private pirouette = 0;
  private turnSign = 1;
  private nearMs = 0;

  constructor(opts: WormOptions) {
    this.rnd = mulberry(opts.seed * 97 + 3);
    this.head = { x: (this.rnd() - 0.5) * 0.6, y: (this.rnd() - 0.5) * 0.6 };
    this.heading = this.rnd() * Math.PI * 2;
    this.food = opts.food ? { x: 0.55, y: -0.35 } : null;
    if (this.food) this.head = { x: -0.5, y: 0.45 };
    for (let k = 0; k < 300; k++) {
      this.trail.unshift({ x: this.head.x - Math.cos(this.heading) * k * 0.002, y: this.head.y - Math.sin(this.heading) * k * 0.002 });
    }
  }

  private conc(p: P) {
    if (!this.food) return 0;
    const d2 = (p.x - this.food.x) ** 2 + (p.y - this.food.y) ** 2;
    return Math.exp(-d2 / (2 * 0.35 ** 2));
  }

  sense(): SenseInput[] {
    const out: SenseInput[] = [];
    // tonic locomotion drive: real worms crawl forward by default
    out.push({ targets: [{ cell_type: "AVB" }], hz: 100 });
    // nose touch: the head is at the dish wall and pointing outwards
    const r = Math.hypot(this.head.x, this.head.y);
    const outward = Math.cos(this.heading - Math.atan2(this.head.y, this.head.x));
    const touch = r > DISH_R - NOSE_RANGE && outward > 0 ? clamp((r - (DISH_R - NOSE_RANGE)) / NOSE_RANGE, 0, 1) : 0;
    if (touch > 0) out.push({ targets: [{ cell_type: "ASH" }, { cell_type: "FLP" }], hz: 60 + 140 * touch });
    if (touch > 0 && !this.touching) {
      this.touches++;
      this.events.push(`Nose touches the dish edge · ASH and FLP stimulated`);
    }
    this.touching = touch > 0;
    // odour: AWC responds when the concentration drops (an OFF cell)
    if (this.food && this.dcdt < -0.004) out.push({ targets: [{ cell_type: "AWC" }], hz: clamp(-this.dcdt * 4000, 0, 180) });
    return out;
  }

  act(rates: Record<string, number>, dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    const fwd = rates.forward ?? 0;
    const bwd = rates.backward ?? 0;
    this.direction = fwd - bwd;
    const speed = clamp(this.direction / 30, -1, 1) * MAX_SPEED;
    const nowReversing = this.reversing ? speed < 0.01 : speed < -0.02;
    if (nowReversing && !this.reversing) {
      this.reversals++;
      this.events.push(`Reversal ${this.reversals} · backward command neurons win`);
    }
    if (!nowReversing && this.reversing) this.events.push("Forward again");
    this.reversing = nowReversing;

    const bend = (rates.dorsal ?? 0) - (rates.ventral ?? 0);
    // When forward and backward command neurons fire together the worm stops
    // and reorients (a pirouette), the way real worms search.
    const conflict = clamp(Math.min(fwd, bwd) / 100, 0, 1);
    if (conflict > 0.3 && this.pirouette <= 0.3) {
      this.turnSign = this.rnd() < 0.5 ? -1 : 1;
      this.events.push("Pirouette · forward and backward commands compete, the worm reorients");
    }
    this.pirouette = conflict;
    this.heading += this.turnSign * conflict * 2.2 * dt;
    this.wander += (this.rnd() - 0.5) * 2 * dt - this.wander * 0.5 * dt;
    // a reversal ends in a sharp turn (omega turn) driven by head motor output
    const turnGain = this.reversing ? 0.02 : 0.004;
    this.heading += (bend * turnGain + this.wander * 1.2) * dt;
    this.phase += dt * Math.PI * 2 * 0.6 * Math.sign(speed || 1);

    if (speed >= 0) {
      this.head = { x: this.head.x + Math.cos(this.heading) * speed * dt, y: this.head.y + Math.sin(this.heading) * speed * dt };
      const last = this.trail[this.trail.length - 1];
      if (Math.hypot(this.head.x - last.x, this.head.y - last.y) > 0.004) this.trail.push({ ...this.head });
      if (this.trail.length > 600) this.trail.shift();
    } else {
      // crawl back along the body's own track
      let dist = -speed * dt;
      while (dist > 0 && this.trail.length > 40) {
        const prev = this.trail[this.trail.length - 2];
        const d = Math.hypot(this.head.x - prev.x, this.head.y - prev.y);
        if (d <= dist) {
          this.trail.pop();
          this.head = { ...prev };
          dist -= d;
        } else {
          const f = dist / d;
          this.head = { x: this.head.x + (prev.x - this.head.x) * f, y: this.head.y + (prev.y - this.head.y) * f };
          dist = 0;
        }
      }
      if (this.trail.length >= 2) {
        const a = this.trail[this.trail.length - 2];
        this.heading = Math.atan2(this.head.y - a.y, this.head.x - a.x);
      }
    }
    // keep inside the dish
    const r = Math.hypot(this.head.x, this.head.y);
    if (r > DISH_R) {
      this.head = { x: (this.head.x / r) * DISH_R, y: (this.head.y / r) * DISH_R };
    }

    if (this.food) {
      const c = this.conc(this.head);
      this.cHistory.push({ t: this.timeMs, c });
      while (this.cHistory.length && this.cHistory[0].t < this.timeMs - 600) this.cHistory.shift();
      const first = this.cHistory[0];
      this.dcdt = this.cHistory.length > 1 ? (c - first.c) / ((this.timeMs - first.t) / 1000) : 0;
      const d = Math.hypot(this.head.x - this.food.x, this.head.y - this.food.y);
      if (d < 0.3) this.nearMs += dtMs;
      if (d < 0.12 && this.foundAt === null) {
        this.foundAt = this.timeMs;
        this.events.push(`Reached the food after ${(this.timeMs / 1000).toFixed(1)} s`);
      }
    }
  }

  distanceToFood() {
    return this.food ? Math.hypot(this.head.x - this.food.x, this.head.y - this.food.y) : NaN;
  }

  get stats() {
    return { reversals: this.reversals, touches: this.touches, foundAt: this.foundAt, distance: this.distanceToFood(), nearFraction: this.nearMs / Math.max(1, this.timeMs) };
  }

  metrics(): Metric[] {
    const m: Metric[] = [
      { label: "Crawling", value: this.reversing ? "backward" : this.direction > 5 ? "forward" : "pausing" },
      { label: "Reversals", value: String(this.reversals) },
      { label: "Edge touches", value: String(this.touches) },
    ];
    if (this.food) {
      m.push({ label: "Distance to food", value: `${(this.distanceToFood() * 10).toFixed(1)} mm` });
      m.push({ label: "Found food", value: this.foundAt === null ? "not yet" : `${(this.foundAt / 1000).toFixed(1)} s` });
      m.push({ label: "Time near food", value: `${Math.round((100 * this.nearMs) / Math.max(1, this.timeMs))}%` });
    }
    return m;
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    const s = Math.min(w, h) / 2.25;
    const cx = w / 2, cy = h / 2;
    const X = (p: P) => cx + p.x * s;
    const Y = (p: P) => cy + p.y * s;
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, w, h);
    // agar dish
    const g = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, s);
    g.addColorStop(0, t.surface);
    g.addColorStop(1, t.bg);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, s * DISH_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.touching ? t.warn : t.line;
    ctx.lineWidth = this.touching ? 3 : 2;
    ctx.stroke();

    if (this.food) {
      const fx = X(this.food), fy = Y(this.food);
      const fg = ctx.createRadialGradient(fx, fy, 2, fx, fy, s * 0.7);
      fg.addColorStop(0, "rgba(214, 160, 60, 0.45)");
      fg.addColorStop(1, "rgba(214, 160, 60, 0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, fy, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(190, 130, 40, 0.9)";
      ctx.beginPath();
      ctx.arc(fx, fy, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.text2;
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText("bacteria lawn", fx - 34, fy + s * 0.1 + 16);
    }

    // faint track
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.trail.forEach((p, k) => {
      const prev = this.trail[k - 1];
      if (k && Math.hypot(p.x - prev.x, p.y - prev.y) < 0.05) ctx.lineTo(X(p), Y(p));
      else ctx.moveTo(X(p), Y(p));
    });
    ctx.stroke();

    // body: last BODY_LEN of the trail, with an undulation
    const pts: P[] = [this.head];
    let len = 0;
    for (let k = this.trail.length - 1; k > 0 && len < BODY_LEN; k--) {
      const a = this.trail[k], b = this.trail[k - 1];
      len += Math.hypot(a.x - b.x, a.y - b.y);
      pts.push(b);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? "rgba(0,0,0,0.12)" : this.reversing ? t.inhib : t.accent;
      ctx.lineWidth = pass === 0 ? s * 0.034 : s * 0.024;
      ctx.beginPath();
      pts.forEach((p, k) => {
        const next = pts[Math.min(k + 1, pts.length - 1)];
        const nx = -(next.y - p.y), ny = next.x - p.x;
        const nl = Math.hypot(nx, ny) || 1;
        const amp = 0.012 * Math.sin(this.phase - k * 0.35) * Math.min(1, k / 6);
        const x = X({ x: p.x + (nx / nl) * amp, y: p.y + (ny / nl) * amp });
        const y = Y({ x: p.x + (nx / nl) * amp, y: p.y + (ny / nl) * amp });
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = t.text;
    ctx.beginPath();
    ctx.arc(X(this.head), Y(this.head), s * 0.008, 0, Math.PI * 2);
    ctx.fill();
  }
}
