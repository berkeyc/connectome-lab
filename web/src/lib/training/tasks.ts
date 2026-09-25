// Training tasks. Each one fixes a real connectome, a sensory mapping and a
// set of readout neurons; the readout weights are what users train.

import { PlateWorld, type PlateSpec } from "./chemotaxis";
import { TrackWorld, type TrackSpec } from "./drive";
import { GYM_TASKS } from "../gym/tasks";
import type { Feature, TrainTask } from "./types";

const DN_TYPES = ["DNa01", "DNa02", "DNa03", "DNb05", "DNa11", "DNp01", "MDN", "DNp09", "DNg13", "DNp03"];
const DN_FEATURES: Feature[] = DN_TYPES.flatMap((t) =>
  (["left", "right"] as const).map((side) => ({
    id: `${t}_${side[0].toUpperCase()}`,
    label: `${t} ${side}`,
    targets: [{ cell_type: t, side }],
  })),
);

const track = (id: string, label: string, w: number, h: number, r: number, lane: number, dir: 1 | -1): TrackSpec => ({ id, label, w, h, r, lane, dir });

// Hand written readout: steer by DNa02 right minus left, the classic turning
// neurons (Rayshubskiy et al. 2020). Positive action turns right.
const handSteer = new Array(DN_FEATURES.length + 1).fill(0);
handSteer[DN_FEATURES.findIndex((f) => f.id === "DNa02_R")] = 1.5;
handSteer[DN_FEATURES.findIndex((f) => f.id === "DNa02_L")] = -1.5;

// RIA and the head motor neurons are left out on purpose: in this spiking model
// they lock into persistent firing after the first odour signal and stop
// carrying information (see the honest notes on the task page).
const WORM_TYPES = ["AIY", "AIZ", "AIB", "RIB", "RIM", "AVA", "AVB"];

const plate = (id: string, label: string, fx: number, fy: number, sx: number, sy: number): PlateSpec => ({ id, label, fx, fy, sx, sy });

export const TASKS: TrainTask[] = [
  {
    id: "fly-steering",
    title: "Teach a real fly circuit to drive",
    species: "fly-visuomotor-circuit",
    tagline: "1,325 neurons from the FlyWire connectome, fixed. Train the readout from 20 descending neurons until the car stays on the track.",
    question: "Does the real wiring carry enough information about the walls for a simple readout to steer, and does it learn faster than a rewired circuit?",
    description: [
      "The car has two range sensors. A wall close on the left drives the left LPLC1 neurons, a wall close on the right drives the right ones. LPLC1 are visual projection neurons that respond to approaching objects and help flies avoid collisions.",
      "From there, activity travels through the real FlyWire wiring (every synapse among the 1,325 neurons of this circuit) to ten descending neuron types on each side of the brain, the cells that carry commands from the brain to the legs.",
      "A readout of 21 numbers per action turns those 20 firing rates into a steering angle. Training searches for those numbers with the cross entropy method: try a population of readouts, keep the best, sample around them, repeat. The circuit itself never changes.",
      "Every candidate drives both ways round a training track. After each generation the current best guess drives a track it has never seen, so you can tell learning from memorising.",
    ],
    senses: ["Wall close on the left → LPLC1 left", "Wall close on the right → LPLC1 right"],
    features: DN_FEATURES,
    actions: [{ id: "steer", label: "Steering" }],
    featureScale: 50,
    smoothMs: 60,
    tickMs: 20,
    episodeMs: 6000,
    varySeeds: true,
    train: [track("oval-ccw", "Oval, anticlockwise", 14, 8, 3, 1.3, 1), track("oval-cw", "Oval, clockwise", 14, 8, 3, 1.3, -1)],
    heldOut: [track("long-ccw", "Long track, anticlockwise", 18, 7, 2.4, 1.2, 1), track("long-cw", "Long track, clockwise", 18, 7, 2.4, 1.2, -1)],
    handDesigned: { label: "DNa02 right minus left (hand written)", weights: handSteer },
    // npm run check:training -- fly-steering real 10 16
    pretrained: {
      weights: [-0.61, 1.06, -1.12, 0.43, 0.03, 0.59, -2.01, -0.08, 0.9, -0.75, 0.43, -0.53, 1.07, 0.22, 0.93, -0.55, -0.45, -0.46, 1.24, -0.26, -0.33],
      generations: 10,
      heldOut: 12.0,
      population: 16,
    },
    createWorld: (spec, seed) => new TrackWorld(spec as TrackSpec, seed),
    inspiredBy: "Fly Dino (Mert Cobanov) and fly-craftax, which also keep the connectome fixed and train only a readout.",
  },
  {
    id: "worm-chemotaxis",
    title: "Teach the worm to find food",
    species: "c-elegans",
    tagline: "The complete 302 neuron worm connectome, fixed. Train a readout from 14 interneurons to turn towards the smell of food.",
    question: "Can the worm's own chemosensory circuit, read by a simple linear readout, turn a changing smell into a search strategy?",
    description: [
      "The worm crawls at constant speed. Like a real worm it cannot smell direction, only whether the odour is getting stronger or weaker over time. When it gets weaker, the AWC neurons fire; when it gets stronger, the left ASE neuron fires.",
      "Activity spreads through the real wiring diagram to the interneurons AIY, AIZ, AIB, RIB and RIM and the command neurons AVA and AVB. A readout of those 14 rates sets how sharply the worm turns. RIA and the head motor neurons are not read: in this simple spiking model they lock into persistent firing after the first odour signal, which real, graded worm neurons do not do.",
      "Real worms solve this with klinokinesis: turn more when things get worse, go straight when they get better. Training has to discover a readout that does the same, using only what the circuit makes of the two sensory signals.",
      "Training plates and held out plates put the food and the start in different places.",
    ],
    senses: ["Odour getting weaker → AWC", "Odour getting stronger → ASE left"],
    features: WORM_TYPES.flatMap((t) =>
      (["left", "right"] as const).map((side) => ({ id: `${t}_${side[0].toUpperCase()}`, label: `${t} ${side}`, targets: [{ cell_type: t, side }] })),
    ),
    actions: [{ id: "turn", label: "Turning" }],
    featureScale: 150,
    smoothMs: 80,
    tickMs: 20,
    episodeMs: 20000,
    varySeeds: false,
    initStd: 0.4,
    train: [plate("a", "Food top right", 0.45, -0.4, -0.45, 0.45), plate("b", "Food bottom left", -0.4, 0.45, 0.5, -0.3)],
    heldOut: [plate("c", "Food left", -0.55, -0.1, 0.55, 0.2), plate("d", "Food bottom", 0.1, 0.55, -0.1, -0.6)],
    createWorld: (spec, seed) => new PlateWorld(spec as PlateSpec, seed),
    inspiredBy: "Pierce-Shimomura et al. (1999) on the pirouette strategy, and Gray, Hill and Bargmann (2005) on the AIY, AIZ and RIA turning circuit.",
  },
  ...GYM_TASKS,
];

export const getTask = (id: string) => TASKS.find((t) => t.id === id);
