// Runs a trained readout inside the live experiment player: the player's
// brain supplies smoothed rates of the readout neurons, this adapter turns
// them into actions for a training world.
import type { Metric, SenseInput, Theme, World } from "../experiments/types";
import type { Snap } from "../three/snap";
import { readout, type EpisodeSpec, type TrainTask, type TrainWorld } from "./types";

export class PolicyWorld implements World {
  private world: TrainWorld;
  private action: number[];
  snapshot?: () => Snap;

  constructor(readonly task: TrainTask, readonly weights: number[], spec: EpisodeSpec, seed: number) {
    this.world = task.createWorld(spec, seed);
    this.action = new Array(task.actions.length).fill(0);
    const w = this.world;
    if (w.snapshot) this.snapshot = () => w.snapshot!();
  }

  get timeMs() {
    return this.world.timeMs;
  }

  sense(): SenseInput[] {
    return this.world.sense();
  }

  act(rates: Record<string, number>, dtMs: number) {
    readout(this.task, this.weights, rates, this.action);
    this.world.act(this.action, dtMs);
  }

  metrics(): Metric[] {
    return this.world.metrics();
  }

  drainEvents() {
    return this.world.drainEvents();
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
    this.world.draw(ctx, w, h, t);
  }
}
