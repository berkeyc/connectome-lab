// Fruit fly worlds: a looming threat, a race track and a parking street.
// The synthetic fly connectome has the real circuit layout (looming detectors
// onto the Giant Fiber, compass neurons EPG onto PFL3 onto the steering neurons
// DNa02, bristle touch onto the moonwalker neurons MDN) with invented weights.

import { clamp, mulberry, wrapAngle, type Metric, type SenseInput, type Theme, type World } from "./types";

type P = { x: number; y: number };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFly(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, size: number, t: Theme, lift = 0, wingPhase = 0) {
  ctx.save();
  ctx.translate(x, y - lift);
  ctx.rotate(heading);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(-lift * 0.3, lift * 0.9, size * 0.9, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // wings
  const spread = lift > 0 ? 0.9 + 0.4 * Math.sin(wingPhase) : 0.25;
  ctx.fillStyle = "rgba(170, 190, 200, 0.55)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-size * 0.35, s * size * 0.35 * (1 + spread), size * 0.75, size * 0.28, s * (0.5 + spread * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  // body
  ctx.fillStyle = t.text;
  ctx.beginPath();
  ctx.ellipse(-size * 0.2, 0, size * 0.62, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size * 0.42, 0, size * 0.24, 0, Math.PI * 2);
  ctx.fill();
  // red eyes
  ctx.fillStyle = "#b8412f";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(size * 0.5, s * size * 0.17, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Looming escape                                                      */
/* ------------------------------------------------------------------ */

export class LoomingWorld implements World {
  timeMs = 0;
  private rnd: () => number;
  private events: string[] = [];
  private threat: { side: 1 | -1; start: number; dist: number } | null = null;
  private nextThreatAt = 1500;
  private jump: { start: number; dir: number } | null = null;
  private escapes = 0;
  private hits = 0;
  private reactions: number[] = [];
  private gf = 0;
  private lastAngle = 0;

  constructor(seed: number) {
    this.rnd = mulberry(seed * 13 + 5);
  }

  private angle() {
    // angular size of an object of radius 1 at distance d
    return this.threat ? 2 * Math.atan(1 / Math.max(this.threat.dist, 0.05)) : 0;
  }

  sense(): SenseInput[] {
    if (!this.threat || this.jump) return [];
    const theta = this.angle();
    const expansion = theta - this.lastAngle; // per tick
    const drive = clamp(expansion * 2600 + theta * 30, 0, 200);
    const side = this.threat.side > 0 ? "right" : "left";
    return drive > 1
      ? [{ targets: [{ cell_type: "LC4", side }, { cell_type: "LPLC2", side }], hz: drive }]
      : [];
  }

  act(rates: Record<string, number>, dtMs: number) {
    this.timeMs += dtMs;
    this.gf = rates.gf ?? 0;
    this.lastAngle = this.angle();
    if (!this.threat && !this.jump && this.timeMs >= this.nextThreatAt) {
      this.threat = { side: this.rnd() < 0.5 ? 1 : -1, start: this.timeMs, dist: 12 };
      this.lastAngle = this.angle();
      this.events.push(`Something approaches from the ${this.threat.side > 0 ? "right" : "left"}`);
    }
    if (this.threat && !this.jump) {
      this.threat.dist -= (dtMs / 1000) * 9; // approach speed
      if (this.gf > 60) {
        const rt = this.timeMs - this.threat.start;
        this.jump = { start: this.timeMs, dir: -this.threat.side };
        this.escapes++;
        this.reactions.push(rt);
        this.events.push(`Giant Fiber fires (${this.gf.toFixed(0)} Hz) · take off after ${rt.toFixed(0)} ms`);
      } else if (this.threat.dist <= 0.3) {
        this.hits++;
        this.events.push("Hit · the fly did not take off");
        this.threat = null;
        this.nextThreatAt = this.timeMs + 1800;
      }
    }
    if (this.jump && this.timeMs - this.jump.start > 1400) {
      this.jump = null;
      this.threat = null;
      this.nextThreatAt = this.timeMs + 1500 + this.rnd() * 1500;
    }
  }

  get stats() {
    return { escapes: this.escapes, hits: this.hits, meanReaction: this.reactions.length ? this.reactions.reduce((a, b) => a + b, 0) / this.reactions.length : NaN };
  }

  metrics(): Metric[] {
    const s = this.stats;
    return [
      { label: "Escapes", value: String(s.escapes) },
      { label: "Hits", value: String(s.hits) },
      { label: "Mean reaction", value: Number.isNaN(s.meanReaction) ? "none yet" : `${s.meanReaction.toFixed(0)} ms` },
      { label: "Giant Fiber", value: `${this.gf.toFixed(0)} Hz` },
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
    // table
    const cx = w / 2, cy = h * 0.58;
    ctx.fillStyle = t.surface;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.42, h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.line;
    ctx.stroke();

    // threat: a dark disk growing from its side
    if (this.threat) {
      const theta = this.angle();
      const r = Math.min(w, h) * 0.5 * (theta / Math.PI) * 1.4;
      const x = cx + this.threat.side * w * (0.12 + 0.28 * Math.min(1, this.threat.dist / 12));
      const g = ctx.createRadialGradient(x, cy - h * 0.25, r * 0.2, x, cy - h * 0.25, r);
      g.addColorStop(0, "rgba(20,20,20,0.85)");
      g.addColorStop(1, "rgba(20,20,20,0.35)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, cy - h * 0.25, r, 0, Math.PI * 2);
      ctx.fill();
      // shadow on the table
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(x, cy, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // fly
    const size = Math.min(w, h) * 0.06;
    if (this.jump) {
      const k = (this.timeMs - this.jump.start) / 1400;
      const lift = Math.sin(Math.min(1, k) * Math.PI) * h * 0.3;
      drawFly(ctx, cx + this.jump.dir * k * w * 0.35, cy, -Math.PI / 2 + this.jump.dir * 0.5, size, t, lift, this.timeMs / 8);
    } else {
      drawFly(ctx, cx, cy, -Math.PI / 2, size, t);
    }
    // GF meter
    ctx.fillStyle = t.text2;
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`Giant Fiber ${this.gf.toFixed(0)} Hz`, 16, 24);
    ctx.fillStyle = t.line;
    ctx.fillRect(16, 32, 160, 6);
    ctx.fillStyle = this.gf > 60 ? t.warn : t.accent;
    ctx.fillRect(16, 32, 160 * clamp(this.gf / 300, 0, 1), 6);
    ctx.fillStyle = t.text2;
    ctx.fillRect(16 + 160 * (60 / 300), 29, 1.5, 12);
  }
}

/* ------------------------------------------------------------------ */
/* Car: shared kinematics                                              */
/* ------------------------------------------------------------------ */

type Car = { x: number; y: number; h: number; v: number; steer: number };

function stepCar(c: Car, targetV: number, steerCmd: number, dt: number, wheelBase: number) {
  c.v += clamp(targetV - c.v, -3 * dt, 3 * dt);
  c.steer += clamp(steerCmd - c.steer, -2.5 * dt, 2.5 * dt);
  c.h += (c.v / wheelBase) * Math.tan(c.steer) * dt;
  c.x += Math.cos(c.h) * c.v * dt;
  c.y += Math.sin(c.h) * c.v * dt;
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, len: number, wid: number, color: string, t: Theme, withFly = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  roundRect(ctx, -len / 2 + 2, -wid / 2 + 3, len, wid, wid * 0.25);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, wid * 0.25);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, len * 0.05, -wid * 0.36, len * 0.22, wid * 0.72, 3);
  ctx.fill();
  if (withFly) drawFly(ctx, -len * 0.12, 0, 0, wid * 0.32, t);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Fly drives a car around a track                                     */
/* ------------------------------------------------------------------ */

const TRACK = { w: 16, h: 9, r: 3.2, lane: 1.3 }; // centerline rounded rectangle, lane half width

function trackCenterClosest(p: P) {
  // distance from the rounded rectangle centerline, and its tangent heading
  const hw = TRACK.w / 2 - TRACK.r, hh = TRACK.h / 2 - TRACK.r;
  const qx = clamp(p.x, -hw, hw), qy = clamp(p.y, -hh, hh);
  const dx = p.x - qx, dy = p.y - qy;
  const d = Math.hypot(dx, dy);
  let nx: number, ny: number;
  if (d > 1e-6) {
    nx = dx / d;
    ny = dy / d;
  } else {
    // inside the inner rectangle: push to nearest edge
    const ex = hw - Math.abs(p.x), ey = hh - Math.abs(p.y);
    if (ex < ey) {
      nx = Math.sign(p.x) || 1;
      ny = 0;
    } else {
      nx = 0;
      ny = Math.sign(p.y) || 1;
    }
  }
  const offset = d - TRACK.r; // >0 outside the centerline
  const center = { x: qx + nx * TRACK.r, y: qy + ny * TRACK.r };
  const tangent = Math.atan2(nx, -ny); // counter clockwise travel
  return { offset, center, tangent };
}

function rayToWall(p: P, ang: number, maxLen: number) {
  for (let s = 0.1; s <= maxLen; s += 0.1) {
    const q = { x: p.x + Math.cos(ang) * s, y: p.y + Math.sin(ang) * s };
    if (Math.abs(trackCenterClosest(q).offset) > TRACK.lane) return s;
  }
  return maxLen;
}

export class DriveWorld implements World {
  timeMs = 0;
  private car: Car;
  private events: string[] = [];
  private rnd: () => number;
  private sensors = { left: 0, right: 0, dl: 0, dr: 0 };
  private crashes = 0;
  private laps = 0;
  private angleTravelled = 0;
  private lastPolar: number;
  private offTrackMs = 0;
  private steerHz = 0;
  private distance = 0;
  private trail: P[] = [];
  static RAY = 3.2;

  constructor(seed: number) {
    this.rnd = mulberry(seed * 7 + 11);
    const start = trackCenterClosest({ x: 0, y: TRACK.h / 2 });
    this.car = { x: start.center.x, y: start.center.y + (this.rnd() - 0.5) * 0.6, h: start.tangent, v: 0, steer: 0 };
    this.lastPolar = Math.atan2(this.car.y, this.car.x);
  }

  sense(): SenseInput[] {
    const a = 0.6;
    const dl = rayToWall(this.car, this.car.h - a, DriveWorld.RAY);
    const dr = rayToWall(this.car, this.car.h + a, DriveWorld.RAY);
    // proximity 0..1, sharpened so only a close wall matters
    const pl = (1 - dl / DriveWorld.RAY) ** 1.5;
    const pr = (1 - dr / DriveWorld.RAY) ** 1.5;
    this.sensors = { left: pl, right: pr, dl, dr };
    const out: SenseInput[] = [];
    // A wall on the left drives the right compass neurons, which steer right
    // through PFL3 and DNa02. This mapping is the experiment's design choice.
    if (pl > 0.02) out.push({ targets: [{ cell_type: "EPG", side: "right" }], hz: 250 * pl });
    if (pr > 0.02) out.push({ targets: [{ cell_type: "EPG", side: "left" }], hz: 250 * pr });
    return out;
  }

  act(rates: Record<string, number>, dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    // note: canvas y points down, so a positive heading change turns right on screen
    this.steerHz = (rates.dna02R ?? 0) - (rates.dna02L ?? 0);
    const steer = clamp(this.steerHz / 25, -1, 1) * 0.6;
    stepCar(this.car, 2.6, steer, dt, 1.1);
    this.distance += Math.abs(this.car.v) * dt;
    const polar = Math.atan2(this.car.y, this.car.x);
    this.angleTravelled += wrapAngle(polar - this.lastPolar);
    this.lastPolar = polar;
    if (Math.abs(this.angleTravelled) >= Math.PI * 2 * (this.laps + 1)) {
      this.laps++;
      this.events.push(`Lap ${this.laps} completed in ${(this.timeMs / 1000).toFixed(1)} s`);
    }
    const tc = trackCenterClosest(this.car);
    if (Math.abs(tc.offset) > TRACK.lane) {
      this.crashes++;
      this.offTrackMs += dtMs;
      this.events.push(`Crash into the ${tc.offset > 0 ? "outer" : "inner"} wall · car put back on the track`);
      this.car.x = tc.center.x;
      this.car.y = tc.center.y;
      this.car.h = tc.tangent;
      this.car.v = 0.6;
      this.car.steer = 0;
    }
    if (this.trail.length === 0 || Math.hypot(this.car.x - this.trail[this.trail.length - 1].x, this.car.y - this.trail[this.trail.length - 1].y) > 0.15) {
      this.trail.push({ x: this.car.x, y: this.car.y });
      if (this.trail.length > 240) this.trail.shift();
    }
  }

  get stats() {
    return { laps: this.laps, crashes: this.crashes, distance: this.distance, crashesPer100m: (100 * this.crashes) / Math.max(1, this.distance) };
  }

  metrics(): Metric[] {
    return [
      { label: "Laps", value: String(this.laps) },
      { label: "Crashes", value: String(this.crashes) },
      { label: "Distance", value: `${this.distance.toFixed(0)} m` },
      { label: "Steering (DNa02 R minus L)", value: `${this.steerHz.toFixed(0)} Hz` },
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
    const s = Math.min(w / (TRACK.w + TRACK.lane * 2 + 1.2), h / (TRACK.h + TRACK.lane * 2 + 1.2));
    const X = (x: number) => w / 2 + x * s, Y = (y: number) => h / 2 + y * s;
    // asphalt
    const draw = (off: number) => {
      const hw = TRACK.w / 2 + off, hh = TRACK.h / 2 + off, r = TRACK.r + off;
      roundRect(ctx, X(-hw), Y(-hh), hw * 2 * s, hh * 2 * s, r * s);
    };
    ctx.fillStyle = t.surface;
    draw(TRACK.lane);
    ctx.fill();
    ctx.fillStyle = t.bg;
    draw(-TRACK.lane);
    ctx.fill();
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 2;
    draw(TRACK.lane);
    ctx.stroke();
    draw(-TRACK.lane);
    ctx.stroke();
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = t.text2;
    ctx.globalAlpha = 0.35;
    draw(0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // start line
    ctx.strokeStyle = t.text2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(TRACK.h / 2 - TRACK.lane));
    ctx.lineTo(X(0), Y(TRACK.h / 2 + TRACK.lane));
    ctx.stroke();
    // trail
    ctx.strokeStyle = t.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.trail.forEach((p, k) => (k ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.stroke();
    ctx.globalAlpha = 1;
    // sensor rays
    for (const [side, a, d, prox] of [
      ["L", -0.6, this.sensors.dl, this.sensors.left],
      ["R", 0.6, this.sensors.dr, this.sensors.right],
    ] as const) {
      ctx.strokeStyle = prox > 0.05 ? t.warn : t.text2;
      ctx.globalAlpha = 0.3 + 0.7 * prox;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(this.car.x), Y(this.car.y));
      ctx.lineTo(X(this.car.x + Math.cos(this.car.h + a) * d), Y(this.car.y + Math.sin(this.car.h + a) * d));
      ctx.stroke();
      void side;
    }
    ctx.globalAlpha = 1;
    drawCar(ctx, X(this.car.x), Y(this.car.y), this.car.h, s * 0.95, s * 0.5, t.accent, t, true);
  }
}

/* ------------------------------------------------------------------ */
/* Fly parallel parks                                                  */
/* ------------------------------------------------------------------ */

const STREET = { curbY: 2.2, slotX: 0, slotLen: 3.2, carLen: 1.6, carWid: 0.8 };

export class ParkingWorld implements World {
  timeMs = 0;
  private car: Car;
  private events: string[] = [];
  private rnd: () => number;
  private reverse = false;
  private parkedAt: number | null = null;
  private bumps = 0;
  private target = { x: STREET.slotX, y: STREET.curbY - STREET.carWid / 2 - 0.12 };
  private cue = { behind: 0, side: 0, bearing: 0 };
  private trail: P[] = [];
  private attempt = 1;
  private phase = "";
  private parks: number[] = [];
  private attemptStart = 0;

  constructor(seed: number) {
    this.rnd = mulberry(seed * 5 + 17);
    this.car = { x: STREET.slotX + 3.3 + this.rnd() * 0.5, y: STREET.curbY - STREET.carWid / 2 - 1.05 - this.rnd() * 0.2, h: 0, v: 0, steer: 0 };
  }

  private parkedCars(): P[] {
    return [
      { x: STREET.slotX - STREET.slotLen / 2 - STREET.carLen / 2 - 0.05, y: STREET.curbY - STREET.carWid / 2 - 0.12 },
      { x: STREET.slotX + STREET.slotLen / 2 + STREET.carLen / 2 + 0.05, y: STREET.curbY - STREET.carWid / 2 - 0.12 },
    ];
  }

  sense(): SenseInput[] {
    if (this.parkedAt !== null) return [];
    // Three cues, like the beeps of a parking sensor:
    //  rear cue: the spot is behind the car      -> bristle neurons BM (reverse)
    //  swing cue: the tail should swing to the curb -> EPG right
    //  straighten cue: the car is angled          -> EPG left
    const c = this.car;
    const ahead = c.x - this.target.x;
    const gapToLine = this.target.y - c.y;
    const out: SenseInput[] = [];
    let phase = "";
    if (ahead < -0.9) {
      // overshot: creep forward and straighten
      phase = "forward";
      const cmd = clamp(-c.h * 2, -1, 1);
      if (cmd > 0.05) out.push({ targets: [{ cell_type: "EPG", side: "right" }], hz: 200 * cmd });
      if (cmd < -0.05) out.push({ targets: [{ cell_type: "EPG", side: "left" }], hz: -200 * cmd });
    } else if (ahead > 2.1 && c.h > -0.05 && gapToLine > 0.35) {
      phase = "back";
      out.push({ targets: [{ cell_type: "BM" }], hz: 160 });
    } else if (gapToLine > 0.62 && c.h > -0.7) {
      phase = "swing";
      out.push({ targets: [{ cell_type: "BM" }], hz: 160 });
      out.push({ targets: [{ cell_type: "EPG", side: "right" }], hz: 230 });
    } else {
      phase = "straighten";
      out.push({ targets: [{ cell_type: "BM" }], hz: 160 });
      const cmd = clamp(-c.h * 2.5, 0, 1);
      if (cmd > 0.05) out.push({ targets: [{ cell_type: "EPG", side: "left" }], hz: 230 * cmd });
    }
    this.cue = { behind: phase === "forward" ? 0 : 1, side: 0, bearing: 0 };
    this.phase = phase;
    return out;
  }

  act(rates: Record<string, number>, dtMs: number) {
    const dt = dtMs / 1000;
    this.timeMs += dtMs;
    if (this.parkedAt !== null) {
      this.car.v = 0;
      if (this.timeMs - this.parkedAt > 3000) this.restart("Next attempt");
      return;
    }
    const mdn = rates.mdn ?? 0;
    const wasReverse = this.reverse;
    this.reverse = this.reverse ? mdn > 15 : mdn > 40;
    if (this.reverse !== wasReverse) this.events.push(this.reverse ? `Moonwalker neurons fire (${mdn.toFixed(0)} Hz) · reverse gear` : "Moonwalker neurons quiet · forward gear");
    const steerHz = (rates.dna02R ?? 0) - (rates.dna02L ?? 0);
    const steer = clamp(steerHz / 25, -1, 1) * 0.55;
    const dist = Math.hypot(this.target.x - this.car.x, this.target.y - this.car.y);
    const speed = clamp(dist * 0.9, 0.2, 0.9);
    stepCar(this.car, this.reverse ? -speed : speed * 0.6, steer, dt, 1.0);

    // collisions with parked cars and the curb
    const corners = (cx: number, cy: number, h: number): P[] =>
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => ({
        x: cx + Math.cos(h) * (a * STREET.carLen) / 2 - Math.sin(h) * (b * STREET.carWid) / 2,
        y: cy + Math.sin(h) * (a * STREET.carLen) / 2 + Math.cos(h) * (b * STREET.carWid) / 2,
      }));
    const mine = corners(this.car.x, this.car.y, this.car.h);
    const inMine = (p: P) => {
      const dx = p.x - this.car.x, dy = p.y - this.car.y;
      const lx = Math.cos(-this.car.h) * dx - Math.sin(-this.car.h) * dy;
      const ly = Math.sin(-this.car.h) * dx + Math.cos(-this.car.h) * dy;
      return Math.abs(lx) < STREET.carLen / 2 && Math.abs(ly) < STREET.carWid / 2;
    };
    const hitCar = this.parkedCars().some(
      (c) =>
        mine.some((p) => Math.abs(p.x - c.x) < STREET.carLen / 2 && Math.abs(p.y - c.y) < STREET.carWid / 2) ||
        corners(c.x, c.y, 0).some(inMine),
    );
    const hitCurb = mine.some((p) => p.y > STREET.curbY);
    if (hitCar || hitCurb) {
      this.bumpEvent(hitCurb ? "curb" : "parked car");
      return;
    }
    const aligned = Math.abs(wrapAngle(this.car.h)) < 0.1;
    const inside = Math.abs(this.car.x - this.target.x) < STREET.slotLen / 2 - STREET.carLen / 2 + 0.25 && Math.abs(this.car.y - this.target.y) < 0.25;
    if (inside && aligned) {
      this.parkedAt = this.timeMs;
      this.parks.push(this.timeMs - this.attemptStart);
      this.events.push(`Parked in ${((this.timeMs - this.attemptStart) / 1000).toFixed(1)} s on attempt ${this.attempt}`);
    }
    const lost = Math.abs(this.car.x) > 6.5 || this.car.y < -2.5;
    if (lost || this.timeMs - this.attemptStart > 25000) {
      this.restart(lost ? `Drove off the street on attempt ${this.attempt}` : `Gave up on attempt ${this.attempt}`);
      return;
    }
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - this.car.x, last.y - this.car.y) > 0.05) this.trail.push({ x: this.car.x, y: this.car.y });
  }

  private bumpEvent(what: string) {
    this.bumps++;
    this.restart(`Bump into the ${what}`);
  }

  private restart(reason: string) {
    this.attempt++;
    this.events.push(`${reason} · attempt ${this.attempt} starts`);
    this.car = { x: STREET.slotX + 3.3 + this.rnd() * 0.5, y: STREET.curbY - STREET.carWid / 2 - 1.05 - this.rnd() * 0.2, h: 0, v: 0, steer: 0 };
    this.trail = [];
    this.parkedAt = null;
    this.reverse = false;
    this.attemptStart = this.timeMs;
  }

  get stats() {
    return { parks: this.parks.length, attempts: this.attempt, bumps: this.bumps, meanParkSeconds: this.parks.length ? this.parks.reduce((a, b) => a + b, 0) / this.parks.length / 1000 : NaN };
  }

  metrics(): Metric[] {
    return [
      { label: "Status", value: this.parkedAt !== null ? "parked" : this.reverse ? "reversing" : "driving forward" },
      { label: "Parked", value: `${this.parks.length} · attempt ${this.attempt}` },
      { label: "Bumps", value: String(this.bumps) },
      { label: "Distance to spot", value: `${Math.hypot(this.target.x - this.car.x, this.target.y - this.car.y).toFixed(2)} m` },
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
    const s = Math.min(w / 11, h / 6.5);
    const X = (x: number) => w / 2 + x * s, Y = (y: number) => h / 2 + (y - 0.6) * s;
    // road and sidewalk
    ctx.fillStyle = t.surface;
    ctx.fillRect(0, Y(-2), w, Y(STREET.curbY) - Y(-2));
    ctx.fillStyle = t.line;
    ctx.fillRect(0, Y(STREET.curbY), w, 4);
    ctx.setLineDash([16, 14]);
    ctx.strokeStyle = t.text2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, Y(-0.4));
    ctx.lineTo(w, Y(-0.4));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // the free spot
    ctx.strokeStyle = this.parkedAt !== null ? t.accent : t.text2;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(X(this.target.x - STREET.slotLen / 2), Y(this.target.y - STREET.carWid / 2 - 0.05), STREET.slotLen * s, (STREET.carWid + 0.1) * s);
    ctx.setLineDash([]);
    for (const c of this.parkedCars()) drawCar(ctx, X(c.x), Y(c.y), 0, STREET.carLen * s, STREET.carWid * s, t.text2, t);
    // trail
    ctx.strokeStyle = t.accent;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    this.trail.forEach((p, k) => (k ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawCar(ctx, X(this.car.x), Y(this.car.y), this.car.h, STREET.carLen * s, STREET.carWid * s, this.reverse ? t.inhib : t.accent, t, true);
    ctx.fillStyle = t.text2;
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(this.reverse ? "gear R · MDN" : "gear D", 16, 24);
  }
}
