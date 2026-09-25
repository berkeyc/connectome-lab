# Connectome Lab

**An open library of mapped nervous systems, and a laboratory to run experiments on them in the browser.**

**Live:** https://connectome-lab-gamma.vercel.app · [train a real fly circuit to drive](https://connectome-lab-gamma.vercel.app/train/fly-steering), watch the [FlyWire escape circuit](https://connectome-lab-gamma.vercel.app/experiments/fly-looming-escape) take off, or [build your own experiment](https://connectome-lab-gamma.vercel.app/community/new)

Scientists have now mapped every neuron and synapse of a worm, a fly larva and an adult fly brain, and pieces of mouse and human cortex. These wiring diagrams (connectomes) are public, but using them takes a research group. Connectome Lab packages them in one open format and lets anyone:

* **watch** real wiring drive a body: a worm backing away from a wall, a FlyWire circuit escaping a looming shadow;
* **train** a readout on a fixed, real circuit and follow the learning curve and the neurons live;
* **compare** every result with rewired, random and silenced circuits, the controls most viral demos leave out;
* **build and share** new experiments as plain JSON (no code), and keep runs in an optional account;
* **explore** a nervous system: classes, transmitters, hubs, who talks to whom, and stimulate or silence any cell type.

The core question behind every experiment: *how much behaviour can the wiring produce, or support, on its own?*

## Experiments

Brains in bodies, live in the browser. The world feeds the senses, the connectome moves the body, and a sidebar shows the brain's signals as scrolling traces, every spike, and an event log. Every fly experiment now runs on circuits cut from the real FlyWire connectome (v783).

| Experiment | Circuit | Real wiring | Controls |
|---|---|---|---|
| [Worm hits the edge of the dish](https://connectome-lab-gamma.vercel.app/experiments/worm-dish-edge) | *C. elegans*, 302 neurons | reverses and turns away at the wall | rarely reverses |
| [Worm searches for food](https://connectome-lab-gamma.vercel.app/experiments/worm-food-search) | *C. elegans* | stays near food longer (odour OFF cell AWC) | wanders off |
| [Fly escapes a looming shadow](https://connectome-lab-gamma.vercel.app/experiments/fly-looming-escape) | FlyWire escape circuit, 1,067 neurons | 30 of 30 take offs, Giant Fiber silent at rest, 330 ms mean reaction | degree preserving rewiring: also escapes but about twice as slow; random wiring: Giant Fiber fires constantly |
| [A real fly circuit drives a car](https://connectome-lab-gamma.vercel.app/experiments/fly-drives-a-car) | FlyWire visuomotor circuit, 1,325 neurons, trained readout | 0 crashes in 40 s on a track it never trained on (3 of 3 seeds) | same readout on rewired circuits: 28 to 35 crashes |
| [Fly runner](https://connectome-lab-gamma.vercel.app/experiments/fly-runner) | FlyWire escape circuit | 0 crashes in 90 s | degree preserving rewiring does equally well (this game cannot tell them apart); random wiring 24 to 26 crashes |
| [Fly parallel parks](https://connectome-lab-gamma.vercel.app/experiments/fly-parallel-parks) | synthetic teaching brain | labelled as a demo of the idea, not a result | |
| The whole fly brain escapes a looming shadow | FlyWire, 138,639 neurons | local runner | |
| Fly plays Minecraft | FlyWire | planned, local runner | |

Numbers come from `npm run check:experiments` and the variant script in the same folder (headless, 3 seeds). Each experiment page shows the measured results and how senses map to neurons and neurons to movement; that mapping is a design choice, and everything in between is the connectome.

## Training

The [training lab](https://connectome-lab-gamma.vercel.app/train) follows the recipe of Fly Dino and fly-craftax: the connectome stays fixed, senses drive fixed input neurons, and a linear readout of chosen output neurons is trained with the cross entropy method, in Web Workers on your own computer. It adds what the demos usually leave out:

* held out episodes, never trained on, scored every generation;
* a hand written readout from known biology as a reference (DNa02 right minus left for steering);
* one click training on rewired, random and silenced circuits, and saved runs overlaid on the same chart.

| Task | Circuit | Result so far |
|---|---|---|
| Fly steering | FlyWire visuomotor circuit (1,325 neurons, 20 descending neuron readouts) | real circuit: held out score about 12 of 14 by generation 2 in 4 of 4 runs; rewired circuits slower and less reliable (11.4 to 11.8, one run 6.0); random and silenced circuits fail. Details in [docs/TRAINING.md](docs/TRAINING.md) |
| Worm chemotaxis | whole *C. elegans* (302 neurons, 14 interneuron readouts) | every circuit memorises the two training plates; on held out plates the real wiring scored 47 against 39 for rewired and silenced circuits (one seed) |

Runs can be saved in the browser, exported and imported as JSON, and synced to an account. Experiments built in the [builder](https://connectome-lab-gamma.vercel.app/community/new) are JSON specs (a circuit, two sets of input neurons, a list of readout neurons): they can be shared as a link and submitted to the community gallery, and they never contain code.

## Community

The [community page](https://connectome-lab-gamma.vercel.app/community) credits the connectome projects that went viral in 2026 (Fly Dino, Swat, the Beat Saber fly, the Minecraft and Doom flies, webgpu-fly and more) with their authors, their code and, where it matters, notes on what the method can show. Browser demos open in a separate window on their authors' own sites. Their code stays with their authors; we link, we do not copy. The main index is [awesome-fly](https://github.com/cobanov/awesome-fly) by Mert Cobanov.

Large experiments run on the **local runner**, a small Python program that simulates the brain on your computer and streams it to the site. The whole FlyWire brain loads in about 10 seconds and needs about 1 GB of memory. See [local/README.md](local/README.md).

## What is in the library

| Species | Neurons | Status | Source |
|---|---|---|---|
| *C. elegans* (nematode worm) | 302 | ✅ real connectome, runs in the browser | Cook et al. 2019, transmitters from Wang et al. 2024, via OpenWorm |
| *Drosophila*, FlyWire escape circuit | 1,067 | ✅ real, cut from FlyWire v783, runs in the browser | Dorkenwald et al. 2024, Schlegel et al. 2024 |
| *Drosophila*, FlyWire visuomotor circuit | 1,325 | ✅ real, cut from FlyWire v783, runs in the browser | same |
| *Drosophila*, whole FlyWire brain | 138,639 | ✅ real, local runner (`python pipeline/import_flywire_v783.py`) | same, connectivity table via Shiu et al. 2024 |
| *Drosophila*, synthetic teaching brain | 5,236 | textbook layout, invented numbers; used only by the parking demo | `pipeline/make_synthetic_fly.py` |
| Fly larva, male fly CNS, *Ciona* larva, mouse and human cortex | | planned | see `pipeline/build_web_bundle.py` |

The FlyWire circuits in `species/` are redistributed under the FlyWire terms (CC BY-NC 4.0, cite the papers listed in each `species.json`); the code is MIT.

### A first result

Stimulating the worm's nose touch sensors (ASH, FLP) drives the backward command interneurons. Five seeds each, crawling direction in Hz (negative means backward):

| Brain | Crawling direction | Active neurons |
|---|---|---|
| Real wiring | **−72.9 ± 0.3** | 112 |
| Same degrees (rewired) | −0.8 ± 3.3 | 32 |
| Random wiring | 0.1 ± 1.0 | 8 |
| Shuffled transmitters | −30.5 ± 23.6 | 41 |

Removing AVA, the classic backward command neuron, cuts the backward drive to a fraction, in line with ablation experiments in real worms. Touching the tail does **not** produce forward crawling in this model, although real worms do move forward. The lab shows these misses as openly as the hits.

## How it works

```
 published datasets                one open format                    two consumers
 ─────────────────                 ───────────────                    ─────────────
 OpenWorm (worm)     ─┐            species/<id>/species.json    ┌──►  PostgreSQL + SQL analyses (db/)
 FlyWire Codex (fly) ─┼─ importers species/<id>/neurons.csv     ┤
 your dataset        ─┘  pipeline/ species/<id>/connections.csv └──►  website + in-browser simulation (web/)
```

* **One format for every animal.** `species.json` holds metadata, citations, caveats, transmitter sign rules, model parameters, behaviour readouts and ready made experiments. Adding an animal means writing one importer. See [docs/ADDING_A_SPECIES.md](docs/ADDING_A_SPECIES.md).
* **Model.** Leaky integrate and fire neurons following Shiu et al. (2024, *Nature*): spikes travel to partners after 1.8 ms, each synapse adds a fixed kick, the sign comes from the sender's transmitter (Dale's law). Worm gap junctions add electrical coupling. The wiring is never trained; only the readouts in the training lab learn.
* **Controls.** Degree preserving rewiring (double edge swaps), random rewiring with the same weights, and shuffled transmitter signs.
* **Runs in the browser.** The engine is plain TypeScript in Web Workers. The FlyWire circuits simulate 5 to 10 times faster than real time on one core.

## Quick start

```bash
git clone https://github.com/berkeyc/connectome-lab.git
cd connectome-lab

# the website (data bundles are committed, so this works right away)
cd web && npm install && npm run dev        # http://localhost:3000
```

Rebuild the data or add species:

```bash
pip install -r requirements.txt
pip install cect                              # OpenWorm ConnectomeToolbox, for the worm importer
python pipeline/import_celegans.py
python pipeline/make_synthetic_fly.py
python pipeline/build_web_bundle.py           # writes web/public/data
```

Load everything into PostgreSQL (local Docker or Supabase) and run the analyses:

```bash
docker compose up -d
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/connectome
python pipeline/load_postgres.py
psql $DATABASE_URL -f db/queries/08_compare_species.sql
psql $DATABASE_URL -v species=c-elegans -v from_type=ASH -v to_type=AVA -f db/queries/06_shortest_path.sql
```

The real FlyWire brain and its browser circuits: `python pipeline/import_flywire_v783.py` downloads the published v783 connectivity table (Shiu et al.) and the FlyWire annotations (Schlegel et al.), writes the whole brain to `data/species/fruit-fly-flywire` and cuts the circuits into `species/`.

Accounts are optional. To turn them on for your own deployment, create a Supabase project, apply `supabase/migrations/`, and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `web/.env.example`). Without them the site works fully and keeps runs in the browser.

## SQL layer

The same schema serves every species (`db/schema.sql`, `db/views.sql`). Each query in `db/queries/` answers one question and takes the species as a psql variable:

| # | Question | Techniques |
|---|---|---|
| 01 | The library at a glance | view over aggregates |
| 02 | What is this nervous system made of, how much of it inhibits? | `FILTER`, window share |
| 03 | Which neurons are hubs, globally and within their class? | `RANK() OVER (PARTITION BY ...)` |
| 04 | Who talks to whom, chemically and electrically? | multi join, windowed share |
| 05 | Which cell types form feedback loops? | self join on the reversed edge |
| 06 | Strongest short route between two cell types | recursive CTE with pruning |
| 07 | How many synapses separate each sense from the output neurons? | recursive breadth first reach |
| 08 | Same statistics, different animals | cross species comparison |

An `experiments` table is ready for storing runs from the website.

## Repository layout

```
species/        the library: one folder per species (committed when small)
pipeline/       importers, PostgreSQL loader, web bundle builder
db/             schema, views and analysis queries
web/            Next.js site; engine in web/src/lib/engine, experiments in web/src/lib/experiments,
                training in web/src/lib/training
supabase/       database migrations for optional accounts (row level security on every table)
local/          local runner for connectomes too big for a browser
docs/           roadmap and contributor guides
data/           large or raw downloads (not committed)
```

## Honest limits

* Every neuron is the same simple unit. Real neurons differ in shape, receptors and dynamics.
* Neuromodulation, synaptic learning and body mechanics are absent. Training changes only a readout, never the circuit.
* The FlyWire browser circuits lack the rest of the brain; the local runner has it all, at lower speed.
* A trained readout can often use any network. A learning curve means little without the controls beside it.
* Most worm neurons are graded rather than spiking, so the worm model is a strong simplification.
* Transmitter identities are partly predicted, and the sign of glutamate depends on the receptor. Each species file states the convention it uses.
* The synthetic fly is for teaching only and is labelled wherever it appears.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md): MaleCNS and the larval fly, NeuroML export for Open Source Brain, a real circuit parking task, and whole brain training on the local runner.

## Related projects

Open Source Brain and NeuroML (runnable model library), OpenWorm (worm data and simulation), FlyWire, Codex, neuPrint and MaleCNS (fly data), Shiu et al.'s Drosophila brain model, NeuroMechFly/FlyGym and flybody (fly bodies), Eon Systems (whole brain emulation), and the awesome-fly list. The [method page](https://connectome-lab-gamma.vercel.app/about) explains how Connectome Lab fits among them: every result is shown next to its controls.

## Citing the data

Each species page and `species.json` lists its sources. The main ones:

* Cook, S. J. et al. (2019). Whole-animal connectomes of both *Caenorhabditis elegans* sexes. *Nature* 571, 63–71.
* Wang, C. et al. (2024). A neurotransmitter atlas of *C. elegans* males and hermaphrodites. *eLife* 13, RP95402.
* Dorkenwald, S. et al. (2024). Neuronal wiring diagram of an adult brain. *Nature* 634, 124–138.
* Shiu, P. K. et al. (2024). A *Drosophila* computational brain model reveals sensorimotor processing. *Nature* 634, 210–219.
* Schlegel, P. et al. (2024). Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature* 634, 139–152.
* OpenWorm ConnectomeToolbox: https://github.com/openworm/ConnectomeToolbox

## Author

**Berke Yaşar Çelik** · Management Information Systems, Ankara.
Code under the MIT licence. Datasets remain under their original terms.
