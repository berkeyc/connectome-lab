// The experiment library. Each entry pairs a connectome with a world.
import type { ExperimentDef } from "./types";
import { LoomingWorld, ParkingWorld } from "./fly";
import { RunnerWorld } from "./runner-game";
import { PolicyWorld } from "../training/policy-world";
import { getTask } from "../training/tasks";
import { WormWorld } from "./worm";

export const WORM_CHANNELS = [
  { id: "forward", label: "Forward command · AVB, PVC", targets: [{ cell_type: "AVB" }, { cell_type: "PVC" }], tone: "accent" as const },
  { id: "backward", label: "Backward command · AVA, AVD, AVE", targets: [{ cell_type: "AVA" }, { cell_type: "AVD" }, { cell_type: "AVE" }], tone: "inhib" as const },
  { id: "dorsal", label: "Head dorsal · RMDD, SMDD", targets: [{ cell_type: "RMDD" }, { cell_type: "SMDD" }], tone: "text" as const },
  { id: "ventral", label: "Head ventral · RMDV, SMDV", targets: [{ cell_type: "RMDV" }, { cell_type: "SMDV" }], tone: "text" as const },
  { id: "nose", label: "Nose touch sensors · ASH, FLP", targets: [{ cell_type: "ASH" }, { cell_type: "FLP" }], tone: "warn" as const },
];

const FLY_STEER = [
  { id: "dna02R", label: "Steer right · DNa02 right", targets: [{ cell_type: "DNa02", side: "right" as const }], tone: "accent" as const },
  { id: "dna02L", label: "Steer left · DNa02 left", targets: [{ cell_type: "DNa02", side: "left" as const }], tone: "inhib" as const },
  { id: "pfl3", label: "Steering command · PFL3", targets: [{ cell_type: "PFL3" }], tone: "text" as const },
  { id: "epg", label: "Compass · EPG", targets: [{ cell_type: "EPG" }], tone: "warn" as const },
];

// The real FlyWire escape pathway. DNp01 is the Giant Fiber; DNp02 and DNp04 are
// other looming responsive descending neurons in the same circuit.
const ESCAPE_CHANNELS = [
  { id: "gf", label: "Giant Fiber · DNp01", targets: [{ cell_type: "DNp01" }], tone: "warn" as const },
  { id: "lc4", label: "Looming detectors · LC4", targets: [{ cell_type: "LC4" }], tone: "accent" as const },
  { id: "lplc2", label: "Looming detectors · LPLC2", targets: [{ cell_type: "LPLC2" }], tone: "accent" as const },
  { id: "dnp02", label: "Looming descending · DNp02, DNp04", targets: [{ cell_type: "DNp02" }, { cell_type: "DNp04" }], tone: "text" as const },
];

const STEER_TASK = getTask("fly-steering")!;
const SHOW = new Set(["DNa01_L", "DNa01_R", "DNa02_L", "DNa02_R", "DNp09_L", "DNp09_R"]);
const STEER_CHANNELS = [
  { id: "lplc1L", label: "LPLC1 left (input)", targets: [{ cell_type: "LPLC1", side: "left" as const }], tone: "warn" as const },
  { id: "lplc1R", label: "LPLC1 right (input)", targets: [{ cell_type: "LPLC1", side: "right" as const }], tone: "warn" as const },
  ...STEER_TASK.features.map((f) => ({ ...f, tone: (f.id.endsWith("_L") ? "inhib" : "accent") as "inhib" | "accent", hidden: !SHOW.has(f.id) })),
];

export const EXPERIMENTS: ExperimentDef[] = [
  {
    id: "worm-dish-edge",
    title: "Worm hits the edge of the dish",
    species: "c-elegans",
    brainKind: "real",
    scene3d: "plate",
    runsIn: "browser",
    tagline: "The real 302 neuron wiring diagram crawls around a dish and backs away when its nose touches the wall.",
    question: "Does the mapped wiring alone turn a nose touch into a reversal?",
    description: [
      "A worm crawls on an agar plate. Every 20 ms the simulation checks whether its nose is pressed against the dish wall. If it is, the nose touch sensors ASH and FLP receive input, exactly as in the nose touch preset of the lab.",
      "Crawl direction comes from the balance of forward (AVB, PVC) and backward (AVA, AVD, AVE) command interneurons. Head bending comes from dorsal and ventral head motor neurons. Nothing else is programmed: whether the worm backs away is decided by the connectome.",
      "Switch the brain to a rewired control and watch the reflex disappear.",
    ],
    senses: ["Nose pressed on the wall → ASH and FLP", "Steady locomotion drive → AVB (real worms crawl forward by default)"],
    motor: ["Forward minus backward command activity → crawl speed and direction", "Dorsal minus ventral head motor activity → turning"],
    channels: WORM_CHANNELS,
    smoothMs: 150,
    speed: 1,
    createWorld: (seed) => new WormWorld({ seed }),
  },
  {
    id: "worm-food-search",
    title: "Worm searches for food",
    species: "c-elegans",
    brainKind: "real",
    scene3d: "plate",
    runsIn: "browser",
    tagline: "An odour gradient, one OFF sensor and the real wiring: does the worm find the bacteria?",
    question: "Can the connectome turn falling odour levels into reorientations that bring the worm to food?",
    description: [
      "Real worms find food with a strategy called klinokinesis: when the smell gets weaker they reverse and turn more often, and when it gets stronger they keep going.",
      "Here, the olfactory neuron AWC is stimulated whenever the odour concentration at the nose drops, as AWC does in real worms. From there the signal has to travel through the wiring diagram to the command interneurons.",
      "The nose touch reflex from the dish edge experiment is still active.",
    ],
    senses: ["Odour decreasing → AWC", "Nose on the wall → ASH and FLP", "Steady locomotion drive → AVB"],
    motor: ["Forward minus backward command activity → crawl speed and direction", "Dorsal minus ventral head motor activity → turning"],
    channels: [...WORM_CHANNELS.slice(0, 4), { id: "awc", label: "Odour sensor · AWC", targets: [{ cell_type: "AWC" }], tone: "warn" }],
    smoothMs: 150,
    createWorld: (seed) => new WormWorld({ seed, food: true }),
  },
  {
    id: "fly-looming-escape",
    title: "Fly escapes a looming shadow",
    species: "fly-escape-circuit",
    brainKind: "real",
    scene3d: "loom",
    runsIn: "browser",
    tagline: "The real FlyWire escape pathway: 1,067 neurons between the looming detectors and the Giant Fiber, every measured synapse.",
    question: "Does the measured looming detector to Giant Fiber wiring produce a fast, reliable escape, and do rewired circuits?",
    description: [
      "Flies escape an approaching object in a fraction of a second. Looming detector neurons (LC4 and LPLC2) respond to an expanding dark shape and drive the Giant Fiber (DNp01 in FlyWire), a descending neuron that triggers the jump.",
      "The circuit here is cut from the FlyWire connectome (v783): all LC4 and LPLC2 neurons, five looming related descending neuron types, and every neuron on strong two step paths between them, with all synapses among them. Nothing is tuned: weights are synapse counts, signs come from predicted transmitters, the neuron model is the published one of Shiu et al. (2024).",
      "The angular size and expansion speed of the object drive LC4 and LPLC2 on the side it comes from. When the Giant Fiber passes 60 Hz the fly takes off; the reaction time is measured from the moment the object appears.",
    ],
    senses: ["Looming object → LC4 and LPLC2 on the side it comes from"],
    motor: ["Giant Fiber (DNp01) above 60 Hz → take off"],
    inspiredBy: "von Reyn et al. (2014), Nature Neuroscience, and Ache et al. (2019), Current Biology, on LC4, LPLC2 and the Giant Fiber.",
    findings: [
      { label: "Real wiring", value: "30 of 30 escapes, Giant Fiber silent at rest, mean reaction 330 ms" },
      { label: "Rewired, same degrees", value: "27 of 27 escapes, but about twice as slow (520 to 1,040 ms)" },
      { label: "Random wiring, shuffled transmitters", value: "Giant Fiber fires all the time, even with nothing approaching: no real reflex" },
      { label: "Measured with", value: "npm run check:experiments, 3 seeds, 40 s each" },
    ],
    channels: ESCAPE_CHANNELS,
    smoothMs: 30,
    createWorld: (seed) => new LoomingWorld(seed),
  },
  {
    id: "fly-drives-a-car",
    title: "A real fly circuit drives a car",
    species: "fly-visuomotor-circuit",
    brainKind: "real",
    scene3d: "track",
    runsIn: "browser",
    tagline: "1,325 FlyWire neurons, fixed. Collision detectors see the walls, a trained readout of 20 descending neurons turns the wheel.",
    question: "Can a readout trained on one track use the real fly circuit to drive a track it has never seen?",
    description: [
      "Two range sensors feed the fly's LPLC1 neurons, which respond to approaching objects: a wall close on the left excites the left LPLC1 cells, a wall on the right the right ones. Activity then travels through the real FlyWire wiring to ten descending neuron types on each side.",
      "A readout of those 20 firing rates sets the steering angle. It was trained in our training lab for 10 generations on an oval track, driven both ways. What you see is a different, longer track that it never trained on.",
      "The circuit is never changed; only the 21 readout numbers were learned. Switch to a rewired brain: the same readout, now reading a circuit it was not trained on, usually drives into the wall.",
    ],
    senses: ["Wall close on the left → LPLC1 left", "Wall close on the right → LPLC1 right"],
    motor: ["Trained readout of 20 descending neurons (DNa01, DNa02, DNp09 and others, each side) → steering", "Throttle constant"],
    inspiredBy: "Fly Dino and fly-craftax, which also train only a readout on a fixed connectome circuit.",
    findings: [
      { label: "Live, 40 s on the held out track", value: "0 crashes and about 78 m, 3 of 3 seeds" },
      { label: "Same readout on a rewired circuit", value: "28 to 33 crashes in 40 s; random wiring 32 to 35" },
      { label: "Held out score after training", value: "12.0 of about 14 possible in a 6 s episode (metres of progress minus 4 per crash)" },
      { label: "Hand written readout (DNa02 right minus left)", value: "3.9 on the same held out track" },
      { label: "Training, real circuit", value: "held out score about 12 by generation 1 or 2 in 4 of 4 runs" },
      { label: "Training, rewired circuits", value: "slower; 3 of 4 rewirings reach 11.4 to 11.8, one stayed unstable (6.0). Random and silenced circuits do not learn" },
      { label: "Train it yourself", value: "/train/fly-steering" },
    ],
    channels: STEER_CHANNELS,
    smoothMs: STEER_TASK.smoothMs,
    dtMs: 0.25,
    createWorld: (seed) => new PolicyWorld(STEER_TASK, STEER_TASK.pretrained!.weights, STEER_TASK.heldOut[0], seed),
  },
  {
    id: "fly-runner",
    title: "Fly runner",
    species: "fly-escape-circuit",
    brainKind: "real",
    scene3d: "runner",
    runsIn: "browser",
    tagline: "Water drops, stones and spiders roll towards the fly. Every hop is a Giant Fiber escape in the real FlyWire circuit.",
    question: "Can the looming escape reflex alone carry a fly through an endless obstacle course?",
    description: [
      "Our take on the viral “Fly Dino” experiment. Instead of a trained readout, this version uses nothing but the escape reflex of the real FlyWire escape circuit: an approaching obstacle grows on the fly's retina, LC4 and LPLC2 fire, and a Giant Fiber burst makes the fly hop.",
      "The course speeds up over time. A hop that comes too early or too late ends the run, and a new run starts after a short pause.",
      "An honest caveat: the degree preserving rewired circuit plays this game just as well. The game only needs a Giant Fiber that stays quiet at rest and fires when something looms, and the rewired circuit keeps both. The random circuits fail because their Giant Fiber never stops firing.",
    ],
    senses: ["Obstacle ahead, growing on the retina → LC4 and LPLC2"],
    motor: ["Giant Fiber (DNp01) above 60 Hz → hop"],
    inspiredBy: "Fly Dino by Mert Cobanov (flydino.cobanov.dev). This is an independent implementation; no code from that project is used.",
    findings: [
      { label: "Real wiring", value: "0 crashes in 90 s, 3 of 3 seeds, about 48 obstacles cleared" },
      { label: "Rewired, same degrees", value: "the same: 0 crashes. This game cannot tell the two apart" },
      { label: "Random wiring, shuffled transmitters", value: "24 to 26 crashes in 90 s" },
    ],
    channels: ESCAPE_CHANNELS,
    smoothMs: 25,
    createWorld: (seed) => new RunnerWorld(seed),
  },
  {
    id: "fly-parallel-parks",
    title: "Fly parallel parks (teaching brain)",
    species: "fruit-fly-synthetic",
    brainKind: "synthetic",
    runsIn: "browser",
    tagline: "A teaching demo on an invented fly brain: forward, reverse and steering from the circuit layout textbooks describe.",
    question: "Can the textbook circuit layout for backward walking and steering be combined into a parking manoeuvre?",
    description: [
      "This experiment runs on the synthetic teaching brain, not on measured data. Its layout follows the literature (bristle neurons onto the moonwalker neurons MDN, compass neurons onto PFL3 onto DNa02) but its numbers are invented, so it shows the idea, not a result about real flies.",
      "When the spot is behind the car, the bristle neurons (BM) are stimulated, which drive MDN, the neurons that make real flies walk backwards. MDN activity puts the car in reverse. The direction to the spot is fed to the compass neurons and DNa02 turns the wheel.",
      "A real circuit version needs a trained readout; it is on our list for the training lab.",
    ],
    senses: ["Spot behind the car → bristle neurons BM", "Direction to the spot → EPG left or right"],
    motor: ["Moonwalker neurons MDN above threshold → reverse gear", "DNa02 right minus left → steering angle"],
    inspiredBy: "Bidaye et al. (2014), Science: neuronal control of Drosophila walking direction (the moonwalker neurons).",
    channels: [{ id: "mdn", label: "Reverse · moonwalker MDN", targets: [{ cell_type: "MDN" }], tone: "warn" }, ...FLY_STEER.slice(0, 2), { id: "bm", label: "Bristle touch · BM", targets: [{ cell_type: "BM" }], tone: "text" }],
    smoothMs: 80,
    createWorld: (seed) => new ParkingWorld(seed),
  },
  {
    id: "flywire-looming-escape",
    title: "The whole fly brain escapes a looming shadow",
    species: "fly-escape-circuit",
    localSpecies: "fruit-fly-flywire",
    brainKind: "real",
    scene3d: "loom",
    runsIn: "local",
    tagline: "The looming escape experiment on all 139,000 neurons of FlyWire, on your own computer.",
    question: "Does the full brain, with every neuron outside the escape circuit present, still produce a clean take off?",
    description: [
      "Identical world and scoring to “Fly escapes a looming shadow”, but the brain is the complete FlyWire connectome in the local runner, so input from the rest of the brain is no longer missing.",
      "The whole brain is too large to simulate in a browser tab in real time, so the runner does the heavy lifting and this page shows the fly, the signals and the log.",
    ],
    senses: ["Looming object → LC4 and LPLC2 on the side it comes from"],
    motor: ["Giant Fiber (DNp01) above 60 Hz → take off"],
    channels: ESCAPE_CHANNELS,
    smoothMs: 30,
    createWorld: (seed) => new LoomingWorld(seed),
    localNotes: [
      "Import the whole brain first: python pipeline/import_flywire_v783.py (downloads about 100 MB from the published Shiu et al. repository and the FlyWire annotations).",
      "Then start the runner: python local/runner.py",
      "Expect the full brain to run slower than real time on a laptop; the page shows the current speed.",
    ],
  },
  {
    id: "fly-plays-minecraft",
    title: "Fly plays Minecraft",
    species: "fly-visuomotor-circuit",
    localSpecies: "fruit-fly-flywire",
    runsIn: "planned",
    tagline: "The viral 2026 demo: a fly connectome walks, turns and jumps through a Minecraft world.",
    question: "Which of the fly's circuits carry over to a 3D game world, and which fail?",
    description: [
      "In September 2026 creators wired the MaleCNS and FlyWire connectomes into Minecraft, mapping the game's view onto visual neurons and descending neurons onto key presses.",
      "Minecraft needs its own game client and server, so this experiment will only ever run on the local runner. The plan: a small bridge that reads the player's surroundings, feeds them to the runner with the same sensor format as the driving experiment, and turns steering, walking and escape neurons into movement and jumps.",
      "Status: planned. The runner protocol it will use is already live for the FlyWire experiments above.",
    ],
    senses: ["Blocks close on the left or right → EPG right or left", "Mob or falling block approaching → LC4 and LPLC2"],
    motor: ["DNa02 right minus left → turn", "Giant Fiber → jump", "Moonwalker neurons MDN → walk backwards"],
    inspiredBy: "“I Put A Fly's Conscious Brain into Minecraft”, the video that started the trend in September 2026.",
    channels: [],
  },
];

export const getExperiment = (id: string) => EXPERIMENTS.find((e) => e.id === id);
