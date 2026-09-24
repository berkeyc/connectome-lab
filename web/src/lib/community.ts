// Connectome experiments made by others that went around the internet in 2026.
// We link to them; we do not copy their code. Where we built our own version of
// the same idea, `ours` points to it.

export type CommunityExperiment = {
  title: string;
  author: string;
  repo: string;
  demo?: string;
  runs: "browser" | "local" | "video";
  brain: string;
  what: string;
  ours?: { id: string; label: string };
};

export const COMMUNITY: CommunityExperiment[] = [
  {
    title: "Fly Dino",
    author: "Mert Cobanov",
    repo: "https://github.com/cobanov/flyjump",
    demo: "https://flydino.cobanov.dev/",
    runs: "browser",
    brain: "80 cell MaleCNS circuit with a trained readout",
    what: "The Chrome dinosaur game played by a fly circuit. The readout learned to use the circuit: 99 of 100 test courses completed, 0 of 100 with the circuit silenced.",
    ours: { id: "fly-runner", label: "Fly runner" },
  },
  {
    title: "Fly Parking Lab",
    author: "powerOFMAX",
    repo: "https://github.com/powerOFMAX/fly-parking-lab",
    runs: "browser",
    brain: "MaleCNS with the NeuroMechFly v2 body and MuJoCo physics",
    what: "Carla, a 3D fly with a biomechanical body, drives and parks a classic Mini Cooper. Runs in the browser with WebAssembly physics once you start it locally.",
    ours: { id: "fly-parallel-parks", label: "Fly parallel parks" },
  },
  {
    title: "Swat",
    author: "hrook1",
    repo: "https://github.com/hrook1/Swat",
    demo: "https://fruitfly-tiny-brain.vercel.app/",
    runs: "browser",
    brain: "About 6,000 MaleCNS neurons driving the escape",
    what: "An arcade game: try to swat a fly whose escape reflex runs on real wiring, with the circuit lighting up as the swatter approaches.",
    ours: { id: "fly-looming-escape", label: "Fly escapes a looming shadow" },
  },
  {
    title: "Closed-Loop Fly",
    author: "ZeroXClem",
    repo: "https://github.com/ZeroXClem/closed-loop-fly",
    runs: "browser",
    brain: "Male central nervous system with a compound eye model",
    what: "Rendered images drive the optic lobe, descending neurons drive the wings, and the new pose renders the next frame: a full sensorimotor loop through a pillar course.",
  },
  {
    title: "Flyhard",
    author: "MarkUnthank",
    repo: "https://github.com/MarkUnthank/flyhard",
    runs: "local",
    brain: "MaleCNS based controller",
    what: "A fly model turns the steering wheel of a car in the CARLA driving simulator.",
    ours: { id: "fly-drives-a-car", label: "Fly drives a car" },
  },
  {
    title: "Fly Brain Minecraft",
    author: "blendi-remade",
    repo: "https://github.com/blendi-remade/fly-brain-minecraft",
    runs: "local",
    brain: "Filtered MaleCNS network",
    what: "A Fabric mod that runs a fly brain inside Minecraft fly mobs.",
    ours: { id: "fly-plays-minecraft", label: "Fly plays Minecraft (planned)" },
  },
  {
    title: "Doomfly",
    author: "nftechie",
    repo: "https://github.com/nftechie/doomfly",
    runs: "local",
    brain: "MaleCNS connected to modelled visual input",
    what: "The fly connectome plays Doom through the ViZDoom research platform, with plasticity experiments.",
  },
  {
    title: "Fly64",
    author: "ornata",
    repo: "https://github.com/ornata/fly",
    runs: "local",
    brain: "MaleCNS",
    what: "The connectome hooked up to Super Mario 64, with a local dashboard of neural activity.",
  },
  {
    title: "Fly Chess Lab",
    author: "tolatolatop",
    repo: "https://github.com/tolatolatop/fly-chess",
    runs: "browser",
    brain: "FlyWire with a Rust and WebAssembly LIF simulation",
    what: "Chess moves chosen from fly brain activity, simulated in the browser with WebAssembly.",
  },
  {
    title: "Embodied whole brain emulation",
    author: "Eon Systems",
    repo: "https://eon.systems/updates/embodied-brain-emulation",
    runs: "video",
    brain: "Complete FlyWire connectome in the NeuroMechFly body",
    what: "The March 2026 demonstration that started it: a whole fly brain emulation walking, grooming and feeding in a physics simulated body.",
  },
];

export const COMMUNITY_SOURCE = { label: "awesome-fly by Mert Cobanov", url: "https://github.com/cobanov/awesome-fly" };
