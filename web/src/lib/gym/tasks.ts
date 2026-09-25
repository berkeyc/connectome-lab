// The trained Fly Gym tasks. All run on the same FlyWire circuit and read the
// same 21 output neurons; only the senses, the world and the actions differ.
// Pretrained readouts come from scripts/gym-benchmark.ts (real circuit, seed 1).

import type { EpisodeSpec, TrainTask } from "../training/types";
import { BanditWorld, type BanditSpec } from "./bandit";
import { ChaseWorld, type ChaseSpec } from "./chase";
import { GYM_FEATURES, GYM_SPECIES } from "./common";
import { FlightWorld, type FlightSpec } from "./flight";
import { PokerWorld, type PokerSpec } from "./poker";
import { PongWorld, type PongSpec } from "./pong";
import { TMazeWorld, type TMazeSpec } from "./tmaze";
import pretrained from "./pretrained.json";

const P = pretrained as Record<string, { weights: number[]; generations: number; heldOut: number; population: number } | undefined>;
const spec = <T extends EpisodeSpec>(s: T) => s;

// Hand written steering: DNa02 right minus left (Rayshubskiy et al. 2020). Positive turns right.
function handSteer(actions = 1) {
  const F = GYM_FEATURES.length;
  const w = new Array(actions * (F + 1)).fill(0);
  w[GYM_FEATURES.findIndex((f) => f.id === "DNa02_R")] = 1.5;
  w[GYM_FEATURES.findIndex((f) => f.id === "DNa02_L")] = -1.5;
  if (actions > 1) w[(F + 1) + F] = 0.5; // walk at a steady speed
  return w;
}

const COMMON = {
  species: GYM_SPECIES,
  features: GYM_FEATURES,
  featureScale: 50,
  tickMs: 20,
  varySeeds: true,
  initStd: 0.7,
};

export const GYM_TASKS: TrainTask[] = [
  {
    ...COMMON,
    id: "gym-poker",
    title: "The fly plays poker",
    tagline: "Kuhn poker, the smallest real poker, played by 1,846 FlyWire neurons and a trained readout of 21 output neurons.",
    question: "Can a fixed fly circuit, read by a simple readout, learn when to bet, call and fold, and how close does it get to the best possible play?",
    description: [
      "Kuhn poker has three cards (jack, queen, king), one card for each player, an ante of one chip and one round of betting. It is small enough to be solved exactly, so every strategy has a known expected value.",
      "The fly sees its card: the jack drives its LC4 neurons, the queen its LPLC2 neurons and the king its LPLC1 neurons. If the opponent has bet, the fly smells odour A (ORN DM1); if the opponent has checked, odour B (ORN DA2). This encoding is arbitrary; what matters is that it is fixed and that everything between senses and output is the real wiring.",
      "A readout of 21 output neurons decides: positive means bet or call, negative means check or fold. Each episode asks the fly for its decision in all 12 situations (3 cards times 4 betting spots) and scores the exact expected chips per hand.",
      "Training plays against two exploitable opponents, a bluffer and a calling station. The held out test is a third style the fly never met, a maniac who bets and calls almost everything. The benchmark also plays the equilibrium player, who cannot be beaten on average: 0 chips per hand is the best anyone can do against it, and betting only with the king already gets there.",
    ],
    senses: ["Jack → LC4", "Queen → LPLC2", "King → LPLC1", "Opponent bet → odour A (ORN DM1)", "Opponent checked → odour B (ORN DA2)"],
    actions: [{ id: "bet", label: "Bet or call (+), check or fold (−)" }],
    smoothMs: 40,
    episodeMs: 12 * 450,
    train: [spec<PokerSpec>({ id: "bluffer", label: "Against a bluffer", opponent: "bluffer" }), spec<PokerSpec>({ id: "station", label: "Against a calling station", opponent: "station" })],
    heldOut: [spec<PokerSpec>({ id: "maniac", label: "Against a maniac (never seen in training)", opponent: "maniac" })],
    pretrained: P["gym-poker"],
    createWorld: (s, seed) => new PokerWorld(s as PokerSpec, seed),
    inspiredBy: "Kuhn (1950), A simplified two-person poker; Libratus and Pluribus for the poker AI that followed.",
  },
  {
    ...COMMON,
    id: "gym-pong",
    title: "The fly plays Pong",
    tagline: "A ball bounces towards the fly. Its collision detectors see which side the ball is on; a trained readout moves the paddle.",
    question: "Can the real circuit turn the position of a moving ball into well timed paddle movements?",
    description: [
      "The fly walks left and right behind a paddle at the end of a walled court. While the ball approaches, its offset from the paddle drives the LPLC1 neurons on that side of the fly, more strongly as the ball comes closer.",
      "A readout of the 21 output neurons sets the walking speed. The score counts hits, minus misses, minus a little for being far from the ball.",
      "Training uses a slower ball; the held out test a faster one with steeper angles.",
    ],
    senses: ["Ball to the left of the paddle → LPLC1 left", "Ball to the right → LPLC1 right"],
    actions: [{ id: "move", label: "Walk right (+) or left (−)" }],
    smoothMs: 40,
    episodeMs: 8000,
    train: [spec<PongSpec>({ id: "slow", label: "Slow ball", speed: 3.2, spin: 0.9 })],
    heldOut: [spec<PongSpec>({ id: "fast", label: "Faster ball", speed: 4.2, spin: 1.2 })],
    pretrained: P["gym-pong"],
    handDesigned: { label: "DNa02 right minus left (hand written)", weights: handSteer() },
    createWorld: (s, seed) => new PongWorld(s as PongSpec, seed),
    inspiredBy: "DishBrain (Kagan et al. 2022), where cultured neurons played Pong.",
  },
  {
    ...COMMON,
    id: "gym-tmaze",
    title: "Odour T-maze with a delay",
    tagline: "Smell odour A, turn left; smell odour B, turn right. Then the same after a pause, which needs memory.",
    question: "Can the circuit link an odour to a turn, and can it still do so when the odour is gone before the decision?",
    description: [
      "Each trial starts with one of two odours: A (ORN DM1, fruity esters) or B (ORN DA2, geosmin). After a delay the fly reaches the junction, and the LC16 neurons signal that it is time to choose. Odour A means left, odour B right.",
      "Training uses no delay and a 100 ms delay. The held out test uses 50 and 300 ms. The model has leaky neurons, no learning and no built in persistent activity, so a long delay is expected to erase the cue.",
      "The benchmark found a more basic limit first: in this circuit the two odours barely reach the 21 output neurons (olfactory receptor neurons are at least three synapses away from them, and few strong paths survive the cut), so no readout can tell A from B, even with no delay. Every circuit stays at chance. A larger circuit with the lateral horn and mushroom body output neurons is the next step.",
    ],
    senses: ["Odour A → ORN DM1", "Odour B → ORN DA2", "Junction reached → LC16 (go signal)"],
    actions: [{ id: "turn", label: "Turn right (+) or left (−)" }],
    smoothMs: 40,
    episodeMs: 7200,
    train: [spec<TMazeSpec>({ id: "short", label: "No delay and 100 ms", delays: "0,100", trials: 6 })],
    heldOut: [spec<TMazeSpec>({ id: "long", label: "50 and 300 ms delays", delays: "50,300", trials: 6 })],
    pretrained: P["gym-tmaze"],
    createWorld: (s, seed) => new TMazeWorld(s as TMazeSpec, seed),
    inspiredBy: "Odour choice assays in T-mazes (Tully and Quinn 1985).",
  },
  {
    ...COMMON,
    id: "gym-bandit",
    title: "Two flowers: learn which one pays",
    tagline: "One flower gives sugar 80% of the time, the other 20%, and they swap halfway. Chance is 50%.",
    question: "With no learning inside the circuit, can echoes of the last visit and its reward be enough to follow the richer flower?",
    description: [
      "Each trial the fly picks a flower. On the chosen flower it sees which side it is on (LPLC1 of that side) and, if the flower paid, tastes sugar (the sugar receptor neurons). Then the next choice comes quickly.",
      "Beating chance needs the rule win stay, lose shift, which needs a memory of the last visit and its result. The circuit cannot learn; any memory has to be activity still echoing in the network. Expect a result near chance: that is the honest answer for a circuit without plasticity.",
      "The score is the expected reward of the chosen flowers (0.5 is chance, 0.8 is the best possible).",
    ],
    senses: ["Choice time → LC16", "On the left or right flower → LPLC1 of that side", "Reward → sugar receptor neurons"],
    actions: [{ id: "choose", label: "Right flower (+) or left (−)" }],
    smoothMs: 40,
    episodeMs: 12 * 460,
    train: [spec<BanditSpec>({ id: "fast", label: "80 / 20, quick trials", rich: 0.8, poor: 0.2, trials: 12, gapMs: 60 })],
    heldOut: [spec<BanditSpec>({ id: "fast-new", label: "80 / 20, new draws", rich: 0.8, poor: 0.2, trials: 12, gapMs: 60 })],
    pretrained: P["gym-bandit"],
    createWorld: (s, seed) => new BanditWorld(s as BanditSpec, seed),
    inspiredBy: "Two armed bandit tasks in flies and mice; Rajagopalan et al. (2023) on reward learning in the fly mushroom body.",
  },
  {
    ...COMMON,
    id: "gym-flight",
    title: "Hold a course in gusty flight",
    tagline: "Gusts knock the flying fly off course. Its motion sensing HS cells and a bar ahead guide a trained steering readout.",
    question: "Can the real circuit turn visual motion into corrective steering, the reflex every flying fly relies on?",
    description: [
      "The fly flies in the middle of a striped drum, like the tethered flight simulators of Götz and Reichardt. Gusts turn it; its own turning is seen as wide field motion by the HS cells of the lobula plate, and a dark bar ahead slides to one side of its view (LPLC1).",
      "A readout of the 21 output neurons sets the steering torque. The score is the mean cosine of the heading error: 1 is straight on course, 0 is lost.",
      "Training uses moderate gusts; the held out test stronger, more frequent ones.",
    ],
    senses: ["Turning right → HS cells right, turning left → HS cells left", "Bar drifting left or right of centre → LPLC1 of that side"],
    actions: [{ id: "torque", label: "Steer right (+) or left (−)" }],
    smoothMs: 40,
    episodeMs: 6000,
    train: [spec<FlightSpec>({ id: "moderate", label: "Moderate gusts", gust: 6, every: 900 })],
    heldOut: [spec<FlightSpec>({ id: "strong", label: "Stronger gusts", gust: 9, every: 700 })],
    pretrained: P["gym-flight"],
    handDesigned: { label: "DNa02 right minus left (hand written)", weights: handSteer() },
    createWorld: (s, seed) => new FlightWorld(s as FlightSpec, seed),
    inspiredBy: "Götz (1968) and Reichardt's flight simulator; Kim et al. (2017) on HS cells and steering.",
  },
  {
    ...COMMON,
    id: "gym-chase",
    title: "Chase a moving target",
    tagline: "Follow another fly around an arena, as a courting male does. Two readouts steer and set the walking speed.",
    question: "Can the circuit keep a moving target in front and close, using only which side it is on and how big it looks?",
    description: [
      "The target's direction drives the LPLC1 neurons on that side of the fly; when it is close and large, the LC4 looming detectors join in. Two readouts of the 21 output neurons set turning and walking speed.",
      "The score is the mean closeness, exp(−distance / 1.5 body lengths). Training uses a slow target; the held out test a faster, more erratic one.",
    ],
    senses: ["Target left or right → LPLC1 of that side", "Target close and large → LC4 of that side"],
    actions: [
      { id: "turn", label: "Turn right (+) or left (−)" },
      { id: "speed", label: "Walk faster (+) or slower (−)" },
    ],
    smoothMs: 40,
    episodeMs: 8000,
    train: [spec<ChaseSpec>({ id: "slow", label: "Slow target", speed: 0.8, wiggle: 1 })],
    heldOut: [spec<ChaseSpec>({ id: "fast", label: "Faster target", speed: 1.2, wiggle: 1.5 })],
    pretrained: P["gym-chase"],
    handDesigned: { label: "DNa02 right minus left, steady walking (hand written)", weights: handSteer(2) },
    createWorld: (s, seed) => new ChaseWorld(s as ChaseSpec, seed),
    inspiredBy: "Courtship chasing and the LC10 visual projection neurons (Ribeiro et al. 2018).",
  },
];
