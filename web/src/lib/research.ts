// Who else runs, explores or builds on connectomes, collected in September 2026.
// Each entry links to its primary source. "checked: false" marks projects seen
// only through community lists (flybrain.info, awesome-fly), not on their own pages.

export type ResearchItem = {
  name: string;
  who: string;
  what: string;
  vsUs: string;
  url: string;
  when?: string;
  checked?: boolean;
};

export type ResearchGroup = { id: string; title: string; blurb: string; items: ResearchItem[] };

export const RESEARCH: ResearchGroup[] = [
  {
    id: "models",
    title: "Whole animal models built on connectomes",
    blurb: "Research groups that simulate a mapped nervous system, sometimes with a body.",
    items: [
      { name: "Drosophila brain model", who: "Philip Shiu, Kristin Scott lab (Berkeley)", what: "Leaky integrate and fire model of all FlyWire neurons; predicted feeding and grooming circuits (Nature 2024).", vsUs: "The model Connectome Lab runs. The original is Python and Brian2 on a desktop, without a body or tasks.", url: "https://github.com/philshiu/Drosophila_brain_model", when: "2024", checked: true },
      { name: "Eon Systems embodied fly", who: "Eon Systems (San Francisco)", what: "The Shiu brain model with the flyvis visual system and the NeuroMechFly body: grooming, feeding, foraging and a partial escape.", vsUs: "The closest concept, aimed at brain uploading. It runs on servers, is shown as video, and publishes no rewired or random controls. Carboncopies has argued that its body routines hide brain errors.", url: "https://eon.systems/updates/embodied-brain-emulation", when: "March 2026", checked: true },
      { name: "flyvis", who: "Turaga lab (Janelia), Macke lab", what: "Connectome constrained network of the fly motion pathway whose weights are trained; predicts responses of 64 cell types (Nature 2024).", vsUs: "Trained weights on real topology, vision only. Connectome Lab keeps synapse counts fixed.", url: "https://github.com/TuragaLab/flyvis", when: "2024", checked: true },
      { name: "flybody", who: "Janelia and Google DeepMind", what: "MuJoCo fly body for walking and flight, controlled by trained neural networks (Nature 2025).", vsUs: "Connectome Lab's fly body. Its original controllers are trained networks, not connectomes.", url: "https://github.com/TuragaLab/flybody", when: "2025", checked: true },
      { name: "NeuroMechFly and FlyGym", who: "Ramdya lab (EPFL)", what: "Fly body with 87 joints, vision, smell and navigation, and a Python gym interface (Nature Methods 2024).", vsUs: "The other body standard; Python, not the browser.", url: "https://neuromechfly.org/", when: "2024", checked: true },
      { name: "FlyGM", who: "Tsinghua University", what: "The whole brain connectome as the graph of a reinforcement learning policy for flybody locomotion.", vsUs: "Trains weights on the real topology; unclear whether shuffled connectomes were tested.", url: "https://arxiv.org/abs/2602.17997", when: "2026", checked: true },
      { name: "BAAIWorm (MetaWorm)", who: "BAAI and Peking University", what: "Biophysical C. elegans network with a soft body in fluid; chemotaxis and perturbation experiments (Nature Computational Science 2024).", vsUs: "The most detailed whole worm today, on GPUs rather than in a browser.", url: "https://github.com/Jessie940611/BAAIWorm", when: "2024", checked: true },
      { name: "OpenWorm", who: "Open community since 2011", what: "The original open whole worm simulation: NeuroML network and fluid body.", vsUs: "The historic peer; slow to run and without a task benchmark. Recent activity not checked.", url: "https://github.com/openworm", checked: true },
      { name: "Virtual rodent", who: "Ölveczky lab (Harvard) and DeepMind", what: "A network trained to move a MuJoCo rat like a real one predicts striatum and motor cortex activity (Nature 2024).", vsUs: "No connectome: the rodent analogue of flybody's trained controllers.", url: "https://www.nature.com/articles/s41586-024-07633-4", when: "2024", checked: true },
      { name: "Fly connectome on Loihi 2", who: "Sandia National Laboratories", what: "The full FlyWire connectome on 12 neuromorphic chips.", vsUs: "A hardware port without behaviour tasks.", url: "https://arxiv.org/abs/2508.16792", when: "2025", checked: true },
    ],
  },
  {
    id: "rigor",
    title: "Benchmarks and control studies",
    blurb: "The small movement that tests real wiring against shuffled or random wiring, like this lab does.",
    items: [
      { name: "flybench", who: "Brandon Cho", what: "Pre-registered reflex benchmark with 36 tasks on FlyWire and MaleCNS, shuffled wiring controls, an embodied track and an open leaderboard.", vsUs: "Controls like ours, reflex tasks in Python; its leaderboard accepts other simulators, so this lab could submit.", url: "https://github.com/brandoncho369/flybench", when: "v0.2.0, September 2026", checked: true },
      { name: "FLY-lab", who: "Recluse", what: "Compares the full connectome, a two line rule, replayed output and a degree preserving shuffle on NeuroMechFly.", vsUs: "Found the connectome equal to a simple rule on steering: a useful null result and a control we do not yet run.", url: "https://github.com/Recluse/FLY-lab", checked: true },
      { name: "fruitfly-lab and fly-aim", who: "OPC Studio", what: "A 3,963 neuron FlyWire pursuit circuit aims and plays Doom without training; real wiring 10.2 kills per episode against 0.7 for scrambled wiring.", vsUs: "The closest in spirit: untrained circuit, controls and lesions, one game.", url: "https://github.com/webergithub/fruitfly-lab", checked: true },
      { name: "FlyDoom", who: "eganeganegan", what: "MaleCNS against random, rewired and standard neural networks on VizDoom.", vsUs: "Controls on a game; no advantage claimed yet.", url: "https://github.com/eganeganegan/flydoom", checked: true },
      { name: "femaleflybrain", who: "opifor", what: "Pre-registered FlyWire, BANC and MaleCNS experiments that record negative results.", vsUs: "An example of publishing failures, which our benchmark also does.", url: "https://github.com/opifor/femaleflybrain", checked: true },
      { name: "Topological sensitivity in connectome constrained networks", who: "Dhiman", what: "The advantage of real topology disappears under shared initialisation and degree preserving nulls.", vsUs: "A warning our benchmark takes seriously: the rewired control keeps each neuron's number of connections.", url: "https://arxiv.org/html/2604.04033v1", when: "April 2026", checked: true },
    ],
  },
  {
    id: "browser",
    title: "Connectomes in the browser and in games",
    blurb: "Community demos from 2025 and 2026, many of them started after the MaleCNS release.",
    items: [
      { name: "webgpu-fly", who: "Ahmet Barış Günaydın", what: "FlyWire brain, MANC nerve cord and flybody body in WebGPU; the player fires descending neurons to reach a target, with deterministic replays.", vsUs: "Technically the closest peer: brain and body in the browser. No control circuits.", url: "https://webgpu-fly.pages.dev/", checked: true },
      { name: "fruit-fly-lab", who: "vaibhavkedarisetti, syn-ack-ai", what: "The whole FlyWire model in a Web Worker with 3D neurons, a raster, a circuit inspector, stimuli and lesions.", vsUs: "Whole brain in the browser without bodies or tasks.", url: "https://github.com/syn-ack-ai/fruit-fly-lab", checked: true },
      { name: "wormlight", who: "Chris J. Zhang", what: "The C. elegans connectome on WebGPU driving a worm on an agar plate, with touch and food.", vsUs: "The worm side of what this lab does, without controls.", url: "https://chrisjz.github.io/wormlight/", checked: true },
      { name: "DOOMFLY", who: "Alex Wormuth (nftechie)", what: "MaleCNS with dopamine gated plasticity plays Doom; reports honestly that one version failed its validation.", vsUs: "Adds learning inside the circuit, which this lab does not.", url: "https://github.com/nftechie/doomfly", when: "September 2026", checked: true },
      { name: "Fly Dino", who: "Mert Cobanov", what: "An 80 neuron fly circuit plays the Chrome dinosaur game.", vsUs: "Inspired our fly runner; trained readout, no controls.", url: "https://flydino.cobanov.dev/", checked: false },
      { name: "flybrain.info and awesome-fly", who: "Community lists", what: "Directories of about 130 fly connectome projects, updated in September 2026.", vsUs: "Where this lab should be listed.", url: "https://flybrain.info/projects/", checked: true },
    ],
  },
  {
    id: "data",
    title: "Connectome datasets",
    blurb: "The wiring diagrams everybody builds on.",
    items: [
      { name: "FlyWire (FAFB v783)", who: "FlyWire consortium, Princeton", what: "The adult female fly brain, about 139,000 neurons, served on Codex.", vsUs: "The source of every fly circuit in this lab.", url: "https://codex.flywire.ai/", checked: true },
      { name: "MaleCNS v1.0", who: "Janelia and Google", what: "Brain and nerve cord of a male fly, more than 166,000 neurons; public release on 3 September 2026.", vsUs: "Next in our library, with the nerve cord for the body loop.", url: "https://male-cns.janelia.org/", when: "September 2026", checked: true },
      { name: "BANC", who: "Harvard (htem) and partners", what: "Female brain and nerve cord, about 160,000 neurons (Nature, June 2026).", vsUs: "A second route to a brain plus nerve cord model.", url: "https://github.com/htem/BANC-project", when: "June 2026", checked: true },
      { name: "MICrONS", who: "IARPA programme, Allen Institute and partners", what: "One cubic millimetre of mouse visual cortex with functional recordings (Nature 2025).", vsUs: "A mammalian dataset on our planned list.", url: "https://www.microns-explorer.org/cortical-mm3", when: "2025", checked: true },
    ],
  },
  {
    id: "orgs",
    title: "Brain emulation and neuroscience organisations",
    blurb: "Groups working towards emulation, validation and open brain data.",
    items: [
      { name: "Carboncopies Foundation", who: "Non-profit", what: "BrainGenix NES simulator and the Brain Emulation Challenge with synthetic ground truth tissue; argues for validating internal dynamics, not just tasks.", vsUs: "Shares our controls first view; our NES bridge connects to their simulator.", url: "https://carboncopies.org/Research/", checked: true },
      { name: "State of Brain Emulation Report 2025", who: "Maximilian Schons and co-authors", what: "The field's reference review of what emulation would take.", vsUs: "Background reading for the method page.", url: "https://arxiv.org/abs/2510.15745", when: "2025", checked: true },
      { name: "E11 Bio", who: "Non-profit research organisation", what: "PRISM barcoding and expansion microscopy for cheaper whole mouse brain connectomes.", vsUs: "Could supply future datasets.", url: "https://www.e11.bio/blog/prism", checked: true },
      { name: "Open Brain Institute", who: "Successor of the Blue Brain Project", what: "Open virtual labs for detailed biophysical brain simulation, launched March 2025.", vsUs: "Detailed neuron models where we use one simple model.", url: "https://www.openbraininstitute.org/", when: "2025", checked: true },
      { name: "Allen Brain Knowledge Platform", who: "Allen Institute", what: "Standardised cell data at scale, launched November 2025.", vsUs: "Cell type data that could refine our neuron model.", url: "https://alleninstitute.org/news/unveiling-comprehensive-ai-neuroscience-tool-brain-knowledge-platform", when: "2025", checked: true },
    ],
  },
  {
    id: "wetware",
    title: "Living neurons that play games",
    blurb: "Biological computing: real tissue with unknown wiring, the mirror image of known wiring in a computer.",
    items: [
      { name: "Cortical Labs (DishBrain, CL1)", who: "Cortical Labs, Melbourne", what: "Cultured neurons played Pong (2022); the CL1 biocomputer followed in 2025 and about 200,000 human neurons played Doom in 2026.", vsUs: "Our Pong task invites a direct comparison between wetware and a mapped circuit.", url: "https://www.scientificamerican.com/article/how-human-neurons-on-a-chip-learned-to-play-doom/", when: "March 2026", checked: true },
      { name: "FinalSpark Neuroplatform", who: "FinalSpark, Switzerland", what: "Remotely accessible human brain organoids for computing experiments.", vsUs: "Living tissue as a service; nothing about wiring is known.", url: "https://finalspark.com/neuroplatform/", checked: true },
    ],
  },
];

export const PEERS = [
  { name: "webgpu-fly", why: "brain, nerve cord and body in the browser, deterministic replays" },
  { name: "fruitfly-lab and fly-aim", why: "untrained circuit in games, against scrambled wiring and lesions" },
  { name: "flybench", why: "shuffled controls, an embodied track and a leaderboard" },
  { name: "FLY-lab", why: "connectome against a shuffle, a replay and a trivial rule on a body" },
  { name: "Eon Systems embodied fly", why: "the same model stack on servers, without published controls" },
  { name: "fruit-fly-lab", why: "whole brain in the browser with lesions and replay" },
  { name: "FlyDoom", why: "MaleCNS against random, rewired and standard networks in a game" },
  { name: "wormlight", why: "the worm connectome and body in WebGPU" },
];

export const GAPS = [
  "Controls on a whole battery of tasks, live in the browser: most demos have no controls, and the projects that do cover a few reflexes or one game.",
  "Two animals, fly and worm, with the same experimental framing.",
  "A realistic fly body driven by a real circuit in the browser and scored against control circuits.",
  "Negative results shown as results: the odour maze fails for every circuit, and the page says why.",
];

export const IDEAS = [
  "Shareable replay links: a seeded address that reproduces a run exactly (webgpu-fly, fruit-fly-lab).",
  "Pre-registration and a log of negative results (flybench, femaleflybrain).",
  "Submit our simulator to the flybench leaderboard and adopt its reflex tasks.",
  "Stronger controls: replayed output and a trivial rule baseline (FLY-lab), shared initialisation (Dhiman 2026).",
  "An efficiency score such as time times spikes (webgpu-fly).",
  "A dataset switcher for FlyWire, MaleCNS and BANC, with the nerve cord in the body loop.",
  "A page comparing our Pong with Cortical Labs' living neurons.",
];
