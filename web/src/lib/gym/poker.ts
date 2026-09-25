// Kuhn poker: the smallest real poker. Three cards (J, Q, K), one card each,
// an ante of one chip, one betting round. It was solved by Harold Kuhn in 1950,
// so every strategy has an exact expected value, and the best possible play
// against any opponent is known. That makes it a test, not a show.
//
// The fly sees its card and what the opponent did through real sensory neurons
// (an arbitrary but fixed encoding), and a trained readout of its descending
// neurons decides: bet or call (positive), check or fold (negative).
//
// Training does not sample hands: each episode asks the fly for its decision in
// all 12 situations (3 cards x 4 betting spots) and scores the exact expected
// chips per hand against the opponent's mixed strategy. The live view plays
// real, dealt hands with the same decisions.

import type { SenseInput, Theme } from "../experiments/types";
import { mulberry } from "../experiments/types";
import type { GymProp, GymSnap } from "../three/snap";
import type { EpisodeSpec, TrainWorld } from "../training/types";
import { card, drawGym, metric, SENSE } from "./common";

export const CARDS = ["J", "Q", "K"];
/** Betting spots where the fly decides. */
export const SPOTS = ["first to act", "checked, then facing a bet", "opponent checked", "facing a bet"] as const;
type Spot = 0 | 1 | 2 | 3;

/** An opponent: probabilities per card (J, Q, K) at each of its decisions. */
export type Opponent = {
  name: string;
  /** as first player: bet */
  bet1: number[];
  /** as first player, after checking and facing a bet: call */
  call1: number[];
  /** as second player, after a check: bet */
  bet2: number[];
  /** as second player, facing a bet: call */
  call2: number[];
};

// Kuhn's equilibrium with alpha = 1/6: never beaten on average.
export const NASH: Opponent = { name: "Equilibrium player", bet1: [1 / 6, 0, 0.5], call1: [0, 0.5, 1], bet2: [1 / 3, 0, 1], call2: [0, 1 / 3, 1] };
export const BLUFFER: Opponent = { name: "Bluffer", bet1: [0.8, 0.6, 1], call1: [0.3, 0.6, 1], bet2: [0.8, 0.5, 1], call2: [0.2, 0.6, 1] };
export const STATION: Opponent = { name: "Calling station", bet1: [0, 0.1, 0.4], call1: [0.7, 0.9, 1], bet2: [0.05, 0.1, 0.5], call2: [0.7, 0.9, 1] };
export const MANIAC: Opponent = { name: "Maniac", bet1: [0.9, 0.9, 1], call1: [0.8, 0.9, 1], bet2: [0.9, 0.8, 1], call2: [0.8, 0.9, 1] };
export const OPPONENTS: Record<string, Opponent> = { nash: NASH, bluffer: BLUFFER, station: STATION, maniac: MANIAC };

/** policy[card * 4 + spot] = 1 for bet or call. */
export type Policy = number[];

/** Exact expected chips per hand for the fly's policy, averaged over the 6 deals and both seats. */
export function expectedValue(p: Policy, o: Opponent) {
  let ev = 0;
  for (let c = 0; c < 3; c++) {
    for (let x = 0; x < 3; x++) {
      if (x === c) continue;
      const win = c > x ? 1 : -1;
      const f = (s: Spot) => p[c * 4 + s];
      // fly acts first
      let a: number;
      if (f(0)) a = o.call2[x] * 2 * win + (1 - o.call2[x]) * 1;
      else a = (1 - o.bet2[x]) * win + o.bet2[x] * (f(1) ? 2 * win : -1);
      // opponent acts first
      let b = o.bet1[x] * (f(3) ? 2 * win : -1);
      b += (1 - o.bet1[x]) * (f(2) ? o.call1[x] * 2 * win + (1 - o.call1[x]) * 1 : win);
      ev += a + b;
    }
  }
  return ev / 12;
}

/** Best any fixed policy can do against this opponent (4,096 policies, checked exhaustively). */
export function bestResponse(o: Opponent) {
  let best = -Infinity;
  for (let m = 0; m < 4096; m++) {
    const p = Array.from({ length: 12 }, (_, i) => (m >> i) & 1);
    best = Math.max(best, expectedValue(p, o));
  }
  return best;
}

export const REFERENCE = {
  alwaysBet: (o: Opponent) => expectedValue(new Array(12).fill(1), o),
  neverBet: (o: Opponent) => expectedValue(new Array(12).fill(0), o),
  /** bet and call only with the king */
  kingsOnly: (o: Opponent) => expectedValue(Array.from({ length: 12 }, (_, i) => (Math.floor(i / 4) === 2 ? 1 : 0)), o),
};

const SHOW_MS = 300;
const READ_MS = 120;
const GAP_MS = 150;

export type PokerSpec = EpisodeSpec & { opponent: string };

type Probe = { card: number; spot: Spot };

export class PokerWorld implements TrainWorld {
  timeMs = 0;
  private rnd: () => number;
  private probes: Probe[] = [];
  private k = 0;
  private phaseMs = 0;
  private sum = 0;
  private n = 0;
  private policy: Policy = new Array(12).fill(0);
  private decided = new Array(12).fill(false);
  private events: string[] = [];
  private opp: Opponent;
  private chips = 0;
  private hands = 0;
  private last: { flyCard: number; oppCard: number; spot: Spot; bet: boolean; result: number; reveal: boolean } | null = null;
  private action = 0;

  constructor(readonly spec: PokerSpec, seed: number) {
    this.rnd = mulberry(seed * 31 + 7);
    this.opp = OPPONENTS[spec.opponent] ?? NASH;
    const all: Probe[] = [];
    for (let c = 0; c < 3; c++) for (let s = 0; s < 4; s++) all.push({ card: c, spot: s as Spot });
    // the order of situations changes with the seed, so nothing can be learnt from the sequence
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    this.probes = all;
  }

  private get probe() {
    return this.probes[this.k % this.probes.length];
  }

  sense(): SenseInput[] {
    if (this.phaseMs >= SHOW_MS) return [];
    const p = this.probe;
    const out: SenseInput[] = [];
    // the card: J, Q and K each drive their own visual projection neurons
    const cardNeurons = [SENSE.lc4("left").concat(SENSE.lc4("right")), SENSE.lplc2(), SENSE.lplc1("left").concat(SENSE.lplc1("right"))][p.card];
    out.push({ targets: cardNeurons, hz: 120 });
    // what happened before: a bet smells of odour A, a check of odour B
    if (p.spot === 1 || p.spot === 3) out.push({ targets: SENSE.odourA, hz: 150 });
    if (p.spot === 2) out.push({ targets: SENSE.odourB, hz: 150 });
    return out;
  }

  act(action: number[], dtMs: number) {
    this.timeMs += dtMs;
    this.phaseMs += dtMs;
    this.action = action[0];
    if (this.phaseMs > SHOW_MS - READ_MS && this.phaseMs <= SHOW_MS) {
      this.sum += action[0];
      this.n++;
    }
    if (this.phaseMs >= SHOW_MS && this.n > 0) {
      const p = this.probe;
      const bet = this.sum / this.n > 0;
      const i = p.card * 4 + p.spot;
      this.policy[i] = bet ? 1 : 0;
      this.decided[i] = true;
      this.playHand(p, bet);
      this.sum = 0;
      this.n = 0;
    }
    if (this.phaseMs >= SHOW_MS + GAP_MS) {
      this.phaseMs = 0;
      this.k++;
      if (this.last) this.last.reveal = false;
    }
  }

  /** Plays one real hand that reaches this situation, for the live view and the chip count. */
  private playHand(p: Probe, bet: boolean) {
    const others = [0, 1, 2].filter((c) => c !== p.card);
    const x = others[Math.floor(this.rnd() * 2)];
    const win = p.card > x ? 1 : -1;
    const o = this.opp;
    let r: number;
    const say = CARDS[p.card];
    if (p.spot === 0) r = bet ? (this.rnd() < o.call2[x] ? 2 * win : 1) : this.rnd() < o.bet2[x] ? -1 : win;
    else if (p.spot === 1) r = bet ? 2 * win : -1;
    else if (p.spot === 2) r = bet ? (this.rnd() < o.call1[x] ? 2 * win : 1) : win;
    else r = bet ? 2 * win : -1;
    const verb = p.spot === 1 || p.spot === 3 ? (bet ? "calls" : "folds") : bet ? "bets" : "checks";
    this.chips += r;
    this.hands++;
    this.last = { flyCard: p.card, oppCard: x, spot: p.spot, bet, result: r, reveal: true };
    this.events.push(`${say}, ${SPOTS[p.spot]}: the fly ${verb} · ${r > 0 ? "+" : ""}${r} chip${Math.abs(r) === 1 ? "" : "s"}`);
  }

  /** Expected chips per hand of the decisions made so far (undecided spots count as check or fold). */
  fitness() {
    return expectedValue(this.policy, this.opp);
  }

  policyTable() {
    return { policy: [...this.policy], decided: [...this.decided] };
  }

  metrics() {
    const done = this.decided.filter(Boolean).length;
    return [
      metric("Opponent", this.opp.name),
      metric("Expected per hand", `${this.fitness() >= 0 ? "+" : ""}${this.fitness().toFixed(3)} chips`),
      metric("Best possible", `${bestResponse(this.opp) >= 0 ? "+" : ""}${bestResponse(this.opp).toFixed(3)}`),
      metric("Chips won (dealt hands)", `${this.chips >= 0 ? "+" : ""}${this.chips} in ${this.hands}`),
      metric("Situations decided", `${done} of 12`),
    ];
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(): GymSnap {
    const p = this.probe;
    const showing = this.phaseMs < SHOW_MS;
    const props: GymProp[] = [
      { id: "table", kind: "cylinder", x: 0, y: -0.02, z: 1.4, sx: 2.6, sy: 0.04, color: "#1f5f45" },
      card("fly-card", -0.5, 0.55, CARDS[p.card], true),
    ];
    const oppCard = this.last?.reveal ? this.last.oppCard : -1;
    props.push(card("opp-card", 0.5, 2.3, oppCard >= 0 ? CARDS[oppCard] : "?", oppCard >= 0));
    // chips in the pot: 2 antes, plus bets
    const pot = 2 + (p.spot === 1 || p.spot === 3 ? 1 : 0) + (!showing && this.last?.bet ? 1 : 0);
    for (let i = 0; i < pot; i++) props.push({ id: `chip${i}`, kind: "cylinder", x: 0.4 + (i % 2) * 0.28, y: 0.03 + Math.floor(i / 2) * 0.07, z: 1.3, sx: 0.12, sy: 0.06, color: i % 2 ? "#d9a441" : "#c33a30" });
    // what the opponent did, as a coloured token on its side
    if (p.spot === 1 || p.spot === 3) props.push({ id: "opp-bet", kind: "cylinder", x: 0.9, y: 0.03, z: 2.0, sx: 0.12, sy: 0.06, color: "#c33a30", glow: 0.4 });
    if (p.spot === 2) props.push({ id: "opp-check", kind: "disc", x: 0.9, y: 0.02, z: 2.0, sx: 0.14, color: "#7a8a99" });
    // the opponent: a second fly across the table
    props.push({ id: "opponent", kind: "fly", x: 0, y: 0, z: 3.1, rot: -Math.PI / 2, sx: 0.8 });
    const verb = p.spot === 1 || p.spot === 3 ? (this.action > 0 ? "call" : "fold") : this.action > 0 ? "bet" : "check";
    return {
      kind: "gym",
      task: "poker",
      fly: { x: 0, y: 0, z: -0.25, h: Math.PI / 2, flap: 0, walk: 0, proboscis: 0 },
      props,
      view: { mode: "fixed", pos: [0, 2.6, -2.2], look: [0, 0, 1.3] },
      bounds: [-2, -1, 2, 3.6],
      hud: { left: `${CARDS[p.card]} · ${SPOTS[p.spot]}`, right: `${this.chips >= 0 ? "+" : ""}${this.chips} chips` },
      signal: showing ? `leaning ${verb}` : this.last ? (this.last.result > 0 ? "won" : "lost") : "",
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    drawGym(ctx, w, h, t, this.snapshot());
  }
}
