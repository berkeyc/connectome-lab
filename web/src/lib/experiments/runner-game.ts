// "Fly runner": a side-scrolling obstacle course, our own take on the viral
// Fly Dino experiment (flydino.cobanov.dev). No code from that project is used.
// Obstacles loom as they approach; the looming detectors LC4 and LPLC2 drive the
// Giant Fiber, and a Giant Fiber burst makes the fly hop, exactly as in the
// looming escape experiment.

import type { RunnerSnap } from "../three/snap";
import { clamp, mulberry, type Metric, type SenseInput, type Theme, type World } from "./types";

type Obstacle = { x: number; w: number; h: number; kind: "drop" | "stone" | "spider"; cleared: boolean };

const EYE_Y = 0.35; // eye height above ground, world units
const JUMP_MS = 520;
const JUMP_H = 1.6;
const FLY_X = 2;

export class RunnerWorld implements World {
  timeMs = 0;
  private rnd: () => number;
  private events: string[] = [];
  private obstacles: Obstacle[] = [];
  private speed = 6; // world units per second
  private distance = 0;
  private jumpAt: number | null = null;
  private deadAt: number | null = null;
  private runStart = 0;
  private cleared = 0;
  private crashes = 0;
  private best = 0;
  private runs = 1;
  private gf = 0;
  private lastTheta = 0;
  private scroll = 0;
  private hopCooldown = 0;
  private hops: number[] = [];

  constructor(seed: number) {
    this.rnd = mulberry(seed * 41 + 9);
    this.spawn(14);
  }

  private spawn(at: number) {
    const r = this.rnd();
    const kind: Obstacle["kind"] = r < 0.45 ? "drop" : r < 0.8 ? "stone" : "spider";
    const size = kind === "stone" ? 0.7 + this.rnd() * 0.5 : kind === "drop" ? 0.6 + this.rnd() * 0.3 : 0.8;
    this.obstacles.push({ x: at, w: size, h: size * (kind === "drop" ? 1.1 : 0.8), kind, cleared: false });
  }

  private flyY() {
    if (this.jumpAt === null) return 0;
    const k = (this.timeMs - this.jumpAt) / JUMP_MS;
    return k >= 1 ? 0 : Math.sin(k * Math.PI) * JUMP_H;
  }

  private next() {
    return this.obstacles.find((o) => o.x + o.w / 2 > FLY_X - 0.2);
  }

  sense(): SenseInput[] {
    if (this.deadAt !== null) return [];
    const o = this.next();
    if (!o) return [];
    const d = Math.max(0.05, o.x - o.w / 2 - FLY_X);
    // rate of expansion of the obstacle on the retina (rad/s): h v / (d^2 + h^2/4)
    const expansion = (o.h * this.speed) / (d * d + (o.h * o.h) / 4);
    this.lastTheta = expansion;
    // Looming detectors respond once the expansion is fast, as a real collision course is.
    const hz = clamp((expansion - 2.6) * 150, 0, 200);
    return hz > 1 ? [{ targets: [{ cell_type: "LC4" }, { cell_type: "LPLC2" }], hz }] : [];
  }

  act(rates: Record<string, number>, dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    this.gf = rates.gf ?? 0;

    if (this.deadAt !== null) {
      if (this.timeMs - this.deadAt > 1400) this.restart();
      return;
    }
    this.hopCooldown = Math.max(0, this.hopCooldown - dtMs);
    const airborne = this.jumpAt !== null && this.timeMs - this.jumpAt < JUMP_MS;
    if (!airborne) this.jumpAt = null;
    if (!airborne && this.gf > 60 && this.hopCooldown === 0) {
      this.jumpAt = this.timeMs;
      this.hops = this.hops.filter((t) => t > this.timeMs - 2500);
      this.hops.push(this.timeMs);
      // flies cannot hop without pause: repeated escapes tire the jump muscles
      this.hopCooldown = JUMP_MS + 80 + (this.hops.length >= 3 ? 900 : 0);
      this.events.push(`Giant Fiber burst (${this.gf.toFixed(0)} Hz) · hop`);
    }

    this.speed = Math.min(11, 6 + (this.timeMs - this.runStart) / 12000);
    const dx = this.speed * dt;
    this.distance += dx;
    this.scroll += dx;
    for (const o of this.obstacles) o.x -= dx;
    const y = this.flyY();
    for (const o of this.obstacles) {
      const overlapX = Math.abs(o.x - FLY_X) < o.w / 2 + 0.25;
      if (overlapX && y < o.h * 0.85) {
        this.crashes++;
        const secs = (this.timeMs - this.runStart) / 1000;
        this.best = Math.max(this.best, this.distance);
        this.events.push(`Hit a ${o.kind === "drop" ? "water drop" : o.kind} after ${secs.toFixed(1)} s and ${this.distance.toFixed(0)} m`);
        this.deadAt = this.timeMs;
        return;
      }
      if (!o.cleared && o.x < FLY_X - o.w / 2 - 0.3) {
        o.cleared = true;
        this.cleared++;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x > -2);
    const last = this.obstacles[this.obstacles.length - 1];
    if (!last || last.x < 18) this.spawn((last?.x ?? 14) + this.speed * (0.9 + this.rnd() * 1.3) + 2.5);
    if (!this.next()) this.lastTheta = 0;
  }

  private restart() {
    this.runs++;
    this.obstacles = [];
    this.distance = 0;
    this.jumpAt = null;
    this.deadAt = null;
    this.runStart = this.timeMs;
    this.lastTheta = 0;
    this.spawn(14);
    this.events.push(`Run ${this.runs} starts`);
  }

  snapshot(): RunnerSnap {
    return {
      kind: "runner",
      obstacles: this.obstacles.map(({ x, w, h, kind }) => ({ x, w, h, kind })),
      flyX: FLY_X,
      flyY: this.flyY(),
      dead: this.deadAt !== null,
      scroll: this.scroll,
      gf: this.gf,
    };
  }

  get stats() {
    return { cleared: this.cleared, crashes: this.crashes, best: Math.max(this.best, this.distance), runs: this.runs };
  }

  metrics(): Metric[] {
    return [
      { label: "Distance", value: `${this.distance.toFixed(0)} m` },
      { label: "Best run", value: `${Math.max(this.best, this.distance).toFixed(0)} m` },
      { label: "Obstacles cleared", value: String(this.cleared) },
      { label: "Crashes", value: String(this.crashes) },
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, w, h);
    const s = w / 20;
    const groundY = h * 0.72;
    const X = (x: number) => x * s;
    const Y = (y: number) => groundY - y * s;

    // distant hills (parallax)
    ctx.fillStyle = t.surface;
    for (let k = -1; k < 6; k++) {
      const x = ((k * 7 - this.scroll * 0.25) % 42 + 42) % 42 - 7;
      ctx.beginPath();
      ctx.ellipse(X(x), groundY, s * 4.5, s * 2.2, 0, Math.PI, 0);
      ctx.fill();
    }
    // leaf surface
    ctx.fillStyle = t.accent;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    for (let k = 0; k < 26; k++) {
      const x = ((k * 1.7 - this.scroll) % 44 + 44) % 44 - 2;
      ctx.beginPath();
      ctx.moveTo(X(x), groundY + 6 + (k % 3) * 8);
      ctx.lineTo(X(x + 0.6), groundY + 6 + (k % 3) * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // obstacles
    for (const o of this.obstacles) {
      const cx = X(o.x), base = groundY;
      if (o.kind === "drop") {
        const g = ctx.createLinearGradient(cx, Y(o.h), cx, base);
        g.addColorStop(0, "rgba(120,170,220,0.95)");
        g.addColorStop(1, "rgba(60,110,180,0.95)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, Y(o.h));
        ctx.bezierCurveTo(cx + (o.w / 2) * s, Y(o.h * 0.45), cx + (o.w / 2) * s, base, cx, base);
        ctx.bezierCurveTo(cx - (o.w / 2) * s, base, cx - (o.w / 2) * s, Y(o.h * 0.45), cx, Y(o.h));
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.ellipse(cx - o.w * s * 0.15, Y(o.h * 0.4), o.w * s * 0.08, o.h * s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === "stone") {
        ctx.fillStyle = t.text2;
        ctx.beginPath();
        ctx.ellipse(cx, base, (o.w / 2) * s, o.h * s, 0, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.strokeStyle = t.text;
        ctx.lineWidth = 2;
        for (let l = -3; l <= 3; l++) {
          if (!l) continue;
          ctx.beginPath();
          ctx.moveTo(cx, Y(o.h * 0.6));
          ctx.quadraticCurveTo(cx + l * s * 0.18, Y(o.h * 1.05), cx + l * s * 0.22, base);
          ctx.stroke();
        }
        ctx.fillStyle = t.text;
        ctx.beginPath();
        ctx.ellipse(cx, Y(o.h * 0.6), s * 0.28, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // the fly, side view
    const fy = Y(this.flyY() + EYE_Y * 0.6);
    const fx = X(FLY_X);
    const flying = this.jumpAt !== null;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, groundY - fy + 2, s * 0.35, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(170,190,200,0.6)";
    const flap = flying ? Math.sin(this.timeMs / 12) * 0.5 : 0;
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, -s * 0.2, s * 0.32, s * 0.12, -0.5 + flap, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.deadAt !== null ? t.warn : t.text;
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, 0, s * 0.28, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.2, -s * 0.02, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8412f";
    ctx.beginPath();
    ctx.arc(s * 0.25, -s * 0.04, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.text;
    ctx.lineWidth = 1.5;
    if (!flying) {
      for (const lx of [-0.2, 0, 0.15]) {
        ctx.beginPath();
        ctx.moveTo(lx * s, s * 0.08);
        ctx.lineTo((lx - 0.08) * s, s * 0.22);
        ctx.stroke();
      }
    }
    ctx.restore();

    // HUD
    ctx.fillStyle = t.text2;
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`${this.distance.toFixed(0).padStart(5, "0")} m   best ${Math.max(this.best, this.distance).toFixed(0)}`, w - 190, 26);
    ctx.fillText(`Giant Fiber ${this.gf.toFixed(0)} Hz`, 16, h - 18);
    ctx.fillStyle = t.line;
    ctx.fillRect(150, h - 26, 140, 6);
    ctx.fillStyle = this.gf > 60 ? t.warn : t.accent;
    ctx.fillRect(150, h - 26, 140 * clamp(this.gf / 300, 0, 1), 6);
    if (this.deadAt !== null) {
      ctx.fillStyle = t.text;
      ctx.font = "600 16px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Crash · next run starting", w / 2, h * 0.3);
      ctx.textAlign = "left";
    }
  }
}
