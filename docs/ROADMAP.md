# Roadmap

## Done

* Library format, importers for *C. elegans* and FlyWire v783, SQL layer with eight analysis queries
* Real FlyWire circuits in the browser (escape, visuomotor) and the whole brain on the local runner
* Experiments with live brain signals, measured results and controls on every page
* Training lab: fixed circuit, CEM trained readout, held out episodes, controls, saved and exported runs
* Experiment builder (JSON specs, shareable links), optional accounts with row level security, community gallery
* 3D scenes with the circuit's neurons at their FlyWire positions, simulated calcium imaging, real neuron skeletons and a BrainGenix-NES bridge
* Realistic articulated fly (flybody model, textured), LED looming arena, glossy grid floor, adaptive quality
* Fly Gym: eight tasks (feeding, backing away, Kuhn poker, Pong, odour T-maze, two armed bandit, flight, chase) on one multisensory FlyWire circuit, benchmarked against controls

## Next

* **More Fly Gym tasks** and a larger gym circuit with the lateral horn and mushroom body output neurons, so odour tasks can work; community tasks as JSON worlds.
* **Real circuit parking.** Replace the last synthetic demo with a trained readout on a FlyWire circuit.
* **More animals.** Male fly CNS (MaleCNS 2026, CC BY 4.0), larval fly (Winding et al. 2023), *Ciona* larva (Ryan et al. 2016).
* **Whole brain training** on the local runner, with the same protocol as the browser.
* **NeuroML export** so circuits can be run in Open Source Brain and other simulators.
* **Body physics.** Couple the circuit to the flybody body in MuJoCo on the local runner, so legs and wings are driven by physics, not animation.
* **Graded neuron model** for worms, and a switch between models, so users can see how model choice changes the answer.

## Later

* **Public leaderboards** of held out scores per task, always with the control runs beside them.
* **Brain versus brain.** Run the same experiment on several species and compare responses side by side.
* **Classroom mode.** Guided experiments for neuroscience courses.
* **API.** Query any connectome in the library over HTTP.
