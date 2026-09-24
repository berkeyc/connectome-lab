# Roadmap

## Now (v0.1)

* Library format, importers for *C. elegans* and FlyWire, synthetic fly
* PostgreSQL schema and eight analysis queries across species
* Website: library, species explorer, in-browser lab with presets, lesions, control brains, share links and JSON export

## Next

* **Real fly in the lab.** Server side simulation for the full FlyWire brain (140,000 neurons), with results cached per experiment.
* **More animals.** Larval fly (Winding et al. 2023), *Ciona* larva (Ryan et al. 2016), male fly CNS (MaleCNS 2026).
* **Saved experiments.** Store runs in the `experiments` table (Supabase), public experiment pages, and a gallery of the most interesting results.
* **Graded neuron model** for worms, and a switch between models, so users can see how model choice changes the answer.

## Later

* **Driving arena.** A 2D track where a connectome steers a vehicle: visual input in, descending neuron output to steering. The question: does the real brain drive better than rewired ones?
* **Brain versus brain.** Run the same experiment on several species and compare responses side by side.
* **Classroom mode.** Guided experiments for neuroscience courses.
* **API.** Query any connectome in the library over HTTP.
