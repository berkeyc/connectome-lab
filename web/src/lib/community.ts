// Connectome experiments made by others. We credit and link to them; we do
// not copy or host their code. Where we built our own version of an idea,
// `ours` points to it. Main index: awesome-fly by Mert Cobanov.

export type CommunityKind = "play" | "games" | "video" | "tools" | "data";

export type CommunityExperiment = {
  title: string;
  author: string;
  /** Source repository, or the original post when there is no public code. */
  repo: string;
  demo?: string;
  kind: CommunityKind;
  brain: string;
  what: string;
  /** Context a careful reader should know (claims, missing code, critiques). */
  note?: string;
  ours?: { href: string; label: string };
};

export const COMMUNITY_KINDS: { id: CommunityKind; title: string; blurb: string }[] = [
  { id: "play", title: "Play in your browser", blurb: "Live demos by their authors. They open in a separate window on the author's own site." },
  { id: "video", title: "Viral demos without public code", blurb: "Shown in videos and posts. We credit them, but nobody outside can rerun them yet." },
  { id: "games", title: "Games and control experiments", blurb: "Open source projects you run on your own computer." },
  { id: "tools", title: "Brain models and embodied simulation", blurb: "Research grade simulators, bodies and training toolkits." },
  { id: "data", title: "Datasets and explorers", blurb: "Where the wiring diagrams come from." },
];

export const COMMUNITY: CommunityExperiment[] = [
  // ---- play in the browser
  {
    title: "Fly Dino",
    author: "Mert Cobanov",
    repo: "https://github.com/cobanov/flyjump",
    demo: "https://flydino.cobanov.dev/",
    kind: "play",
    brain: "Fixed 80 neuron MaleCNS circuit with a trained readout",
    what: "The Chrome dinosaur game played by a fly circuit. The readout learned to use the circuit: 99 of 100 test courses completed, 0 of 100 with the circuit silenced.",
    note: "The recipe our training lab follows: fixed circuit, trained readout, silenced control.",
    ours: { href: "/train/fly-steering", label: "Train a readout yourself" },
  },
  {
    title: "Swat",
    author: "hrook1",
    repo: "https://github.com/hrook1/Swat",
    demo: "https://fruitfly-tiny-brain.vercel.app/",
    kind: "play",
    brain: "About 6,000 MaleCNS neurons driving the escape",
    what: "An arcade game: try to swat a fly whose escape reflex runs on real wiring, with the circuit lighting up as the swatter approaches.",
    ours: { href: "/experiments/fly-looming-escape", label: "Our looming escape" },
  },
  {
    title: "Help the Fly Escape",
    author: "dzhng",
    repo: "https://github.com/dzhng/fly-escape",
    demo: "https://fly-escape.vercel.app/",
    kind: "play",
    brain: "Fly connectome controller in a 3D scene",
    what: "Arrange household objects and watch simulated flies navigate a 3D browser game.",
  },
  {
    title: "Fly Chess Lab",
    author: "tolatolatop",
    repo: "https://github.com/tolatolatop/fly-chess",
    demo: "https://tolatolatop.github.io/fly-chess/",
    kind: "play",
    brain: "FlyWire with a Rust and WebAssembly LIF simulation",
    what: "Chess moves chosen from fly brain activity, simulated in the browser.",
  },
  {
    title: "webgpu-fly",
    author: "abgnydn",
    repo: "https://github.com/abgnydn/webgpu-fly",
    demo: "https://webgpu-fly.pages.dev/",
    kind: "play",
    brain: "FlyWire brain on WebGPU joined to the flybody model",
    what: "A whole brain simulation on the graphics card of your browser, driving a physically modelled fly body.",
  },
  {
    title: "FLYFEAR",
    author: "furkancak1r",
    repo: "https://github.com/furkancak1r/flyfear",
    demo: "https://furkancakir.dev/flyfear/",
    kind: "play",
    brain: "MaleCNS derived simulation",
    what: "A small Godot horror game where the fly's behaviour comes from a connectome simulation.",
  },
  {
    title: "Infinite Sugar",
    author: "cnqso",
    repo: "https://github.com/cnqso/infinite-sugar",
    demo: "https://infinitesugar.cnqso.com/",
    kind: "play",
    brain: "FlyWire based fly with sweet sensing input",
    what: "A browser artwork: a fly in a terrarium that follows the taste of sugar.",
  },

  // ---- viral demos without public code
  {
    title: "A fly playing Beat Saber",
    author: "lyra bubbles (@_lyraaaa_)",
    repo: "https://x.com/_lyraaaa_/status/2097527368919470162",
    kind: "video",
    brain: "Fly connectome with a motor readout trained on gameplay",
    what: "The September 2026 clip of a fly connectome slicing blocks in Beat Saber, which spread widely.",
    note: "No code or data has been published, so the result cannot be checked. The motor mapping was trained on recorded play, which Patrick Mineault argues makes it hard to say how much the wiring itself contributes (neuroai.science, “Are flies playing Beat Saber?”).",
  },
  {
    title: "A fly's brain in Minecraft",
    author: "Ro0oney",
    repo: "https://www.youtube.com/watch?v=BUkLWjcoBc0",
    kind: "video",
    brain: "FlyWire connectome",
    what: "A video of a fly connectome walking and turning in a Minecraft world.",
    note: "Video only; no code has been published.",
    ours: { href: "/experiments/fly-plays-minecraft", label: "Planned local version" },
  },
  {
    title: "Embodied whole brain emulation",
    author: "Eon Systems",
    repo: "https://eon.systems/updates/embodied-brain-emulation",
    kind: "video",
    brain: "Complete FlyWire connectome in the NeuroMechFly body",
    what: "The March 2026 demonstration: a whole fly brain simulation walking, grooming and feeding in a physics simulated body.",
    note: "Their simulator is public (eonsystemspbc/fly-brain, GPL 2.0); some claims about the behaviour were debated by researchers.",
  },

  // ---- games and control
  {
    title: "Fly Parking Lab",
    author: "powerOFMAX",
    repo: "https://github.com/powerOFMAX/fly-parking-lab",
    kind: "games",
    brain: "NeuroMechFly v2 body with MuJoCo physics",
    what: "A 3D fly drives and parks a Mini Cooper, in the browser once you start it locally.",
    note: "The public repository contains no connectome data file and no licence, so we could not check how much of the driving comes from wiring.",
  },
  { title: "Flyhard", author: "MarkUnthank", repo: "https://github.com/MarkUnthank/flyhard", kind: "games", brain: "MaleCNS based controller", what: "A fly model turns the steering wheel of a car in the CARLA driving simulator.", ours: { href: "/train/fly-steering", label: "Our trained driver" } },
  { title: "Fly Brain Minecraft", author: "blendi-remade", repo: "https://github.com/blendi-remade/fly-brain-minecraft", kind: "games", brain: "Filtered MaleCNS network", what: "A Fabric mod that runs a fly brain inside Minecraft fly mobs." },
  { title: "NeuroCraft Fly", author: "evnsnclr", repo: "https://github.com/evnsnclr/neurocraft-fly-public", kind: "games", brain: "MaleCNS", what: "An interactive Minecraft project around a MaleCNS based fly." },
  { title: "Doomfly", author: "nftechie", repo: "https://github.com/nftechie/doomfly", kind: "games", brain: "MaleCNS with modelled visual input", what: "The fly connectome plays Doom through the ViZDoom research platform, with plasticity experiments." },
  { title: "FlyDoom", author: "eganeganegan", repo: "https://github.com/eganeganegan/flydoom", kind: "games", brain: "MaleCNS constrained controllers", what: "A framework that compares connectome constrained controllers on ViZDoom tasks, with controls." },
  { title: "Fly64", author: "ornata", repo: "https://github.com/ornata/fly", kind: "games", brain: "MaleCNS", what: "The connectome hooked up to Super Mario 64, with a local dashboard of neural activity." },
  { title: "FlyPong", author: "jonatasperaza", repo: "https://github.com/jonatasperaza/FlyPong", kind: "games", brain: "MaleCNS subgraph", what: "Pong played by a connectome subgraph, with plasticity experiments." },
  { title: "fly-craftax", author: "liuzihe02", repo: "https://github.com/liuzihe02/fly-craftax", kind: "games", brain: "Connectome simulation with a PPO trained readout", what: "A fly circuit linked to the Craftax survival game and trained with reinforcement learning." },
  { title: "Closed-Loop Fly", author: "ZeroXClem", repo: "https://github.com/ZeroXClem/closed-loop-fly", kind: "games", brain: "Male CNS with a compound eye model", what: "Rendered images drive the optic lobe, descending neurons drive the wings: a full sensorimotor loop through a pillar course." },
  { title: "DesktopFly", author: "DenisSergeevitch", repo: "https://github.com/DenisSergeevitch/desktop-fly", kind: "games", brain: "FlyWire circuits and a MaleCNS brain to leg extract", what: "A fly that lives on your macOS desktop." },

  // ---- tools
  { title: "Drosophila brain model", author: "Philip Shiu et al.", repo: "https://github.com/philshiu/Drosophila_brain_model", kind: "tools", brain: "Whole FlyWire brain, leaky integrate and fire", what: "The research code behind Shiu et al. (2024, Nature). Our neuron model and parameters follow it, and our FlyWire connectivity table comes from it." },
  { title: "flybody", author: "TuragaLab, Google DeepMind, HHMI Janelia", repo: "https://github.com/TuragaLab/flybody", kind: "tools", brain: "Body model", what: "An anatomically detailed MuJoCo fruit fly body with environments for walking and flight." },
  { title: "FlyGym / NeuroMechFly", author: "NeLy lab, EPFL", repo: "https://github.com/NeLy-EPFL/flygym", kind: "tools", brain: "Body model", what: "A Python framework for embodied sensorimotor experiments with a simulated fly." },
  { title: "flyvis", author: "TuragaLab", repo: "https://github.com/TuragaLab/flyvis", kind: "tools", brain: "Connectome constrained visual system", what: "PyTorch models of the fly visual system trained under connectome constraints." },
  { title: "train-your-fly", author: "eudald-seeslab", repo: "https://github.com/eudald-seeslab/train-your-fly", kind: "tools", brain: "Connectome constrained graph networks", what: "A toolkit for training vision models whose wiring follows the fly connectome." },
  { title: "Open Source Brain", author: "Open Source Brain", repo: "https://www.opensourcebrain.org/", kind: "tools", brain: "Many species and models", what: "The closest existing library of runnable neuroscience models, built on NeuroML. A natural home for exporting our circuits." },
  {
    title: "BrainGenix-NES",
    author: "Carboncopies Foundation",
    repo: "https://github.com/carboncopies/BrainGenix-NES",
    kind: "tools",
    brain: "Neurons with geometry, virtual calcium imaging and electron microscopy",
    what: "A whole brain emulation simulator that can also render what a microscope would see. Our simulated calcium imaging view follows the same idea, and our NES bridge builds any FlyWire circuit from the library inside NES.",
    note: "AGPL 3.0. We talk to it over its documented API and use none of its code.",
    ours: { href: "/about#nes", label: "How we connect to NES" },
  },
  {
    title: "Brain Emulation Challenge",
    author: "Carboncopies Foundation",
    repo: "https://github.com/carboncopies/BrainEmulationChallenge",
    kind: "tools",
    brain: "Small ground truth circuits (XOR, adder, memory)",
    what: "Standardised circuits with known wiring, a submission format and a scorecard for how well an emulation matches the original. A model for fair benchmarks on real connectomes.",
  },
  { title: "OpenWorm", author: "OpenWorm", repo: "https://github.com/openworm/ConnectomeToolbox", kind: "tools", brain: "C. elegans", what: "Open worm connectome datasets and tools; our worm data comes from their ConnectomeToolbox." },

  // ---- data
  { title: "FlyWire", author: "Seung and Murthy labs and the FlyWire consortium", repo: "https://flywire.ai/", demo: "https://codex.flywire.ai/", kind: "data", brain: "Adult female brain, about 139,000 neurons", what: "The whole brain connectome our fly circuits are cut from (v783)." },
  { title: "FlyWire annotations", author: "flyconnectome (Schlegel et al.)", repo: "https://github.com/flyconnectome/flywire_annotations", kind: "data", brain: "Cell types for FlyWire v783", what: "The cell type names we use for inputs and readouts." },
  { title: "MaleCNS", author: "HHMI Janelia and partners", repo: "https://male-cns.janelia.org/", kind: "data", brain: "Male brain and nerve cord, about 166,000 neurons", what: "The 2026 male central nervous system used by most of the viral demos. Planned for our library." },
];

export const COMMUNITY_SOURCE = { label: "awesome-fly by Mert Cobanov", url: "https://github.com/cobanov/awesome-fly" };
