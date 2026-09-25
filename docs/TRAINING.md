# Training on a fixed connectome

The training lab keeps the wiring diagram exactly as measured and trains only a linear readout. This page records the method and the results so far, including the ones that do not flatter the real wiring.

## Method

* **Circuit.** A connectome, fixed: synapse counts as weights, signs from predicted transmitters, the leaky integrate and fire model of Shiu et al. (2024). Training uses a 0.25 ms step instead of 0.1 ms (2.5 times faster; firing rates change by about 2 percent in these circuits).
* **Senses.** A world excites fixed input neurons with Poisson input whose rate follows a sensor.
* **Readout.** Smoothed firing rates of chosen output neurons, divided by a scale, go through `tanh(w · rates + b)`. Only `w` and `b` are learned.
* **Optimiser.** Cross entropy method: population 12 to 48, the best quarter are the elites, the next generation is sampled around their mean with their spread plus a small decaying noise. The current mean always competes, so a generation never loses its best guess.
* **Evaluation.** Every candidate is scored on all training episodes. After each generation the mean readout is scored on held out episodes it never trained on.
* **Controls.** The same training on a degree preserving rewired circuit, a randomly wired circuit (same weights), and a silenced circuit (only the constant term can learn).

Reproduce any number here with

```bash
cd web
npm run check:training -- <task> <variant> <generations> <population> <seed>
# e.g. npm run check:training -- fly-steering degree 8 12 3
```

## Fly steering

Circuit: FlyWire visuomotor circuit (1,325 neurons). Input: LPLC1 left or right when a wall is close on that side. Readout: 20 descending neuron groups (10 types, each side). Training: an oval track driven both ways, 6 s per episode. Held out: a longer, narrower track, both ways. Score: metres of progress minus 4 per crash; about 14 is the maximum.

| Circuit | Runs | Held out score after 8 to 10 generations | Notes |
|---|---|---|---|
| Real wiring | 4 (seeds 1 to 4) | 11.9, 12.0, 12.0, 12.1 | about 12 by generation 1 or 2 in every run, then stable |
| Rewired, same degrees | 4 (seeds 1 to 4, each a different rewiring) | 11.6, 11.4, 11.8, 6.0 | slower (2 to 8 generations); one rewiring stayed unstable |
| Random wiring | 1 | about −1 | the circuit fires constantly, so it carries no wall information |
| Silenced | 1 | between −3 and 1.5 | a constant steering angle is all it can learn |
| Hand written DNa02 right minus left | – | 3.9 | the classic turning neurons alone, no training |

Live check of the shipped readout (trained on the real circuit, 10 generations, population 16), 40 s on the held out track: real circuit 0 crashes in 3 of 3 seeds; the same readout on rewired circuits 28 to 33 crashes, on random wiring 32 to 35.

What this shows: the real circuit's descending neurons carry clean, lateralised information about which wall is close (LPLC1 left drives, for example, DNa01 right and DNp09 left), so a simple readout finds a solution almost at once and it transfers to a new track. A degree preserving rewiring usually carries enough information too, but less reliably. The task is easy; it demonstrates information flow, not that the fly brain "drives".

## Worm chemotaxis

Circuit: the whole *C. elegans* hermaphrodite connectome (302 neurons). Input: AWC when the log odour concentration falls, ASE left when it rises. Readout: 14 interneuron groups (AIY, AIZ, AIB, RIB, RIM, AVA, AVB, each side). The worm crawls at constant speed; the readout sets its turning rate. Two training plates, two held out plates, 20 s each. Score: mean closeness to food, 0 to 100.

| Circuit | Training plates | Held out plates |
|---|---|---|
| Real wiring | 59 | 47 |
| Rewired, same degrees | 60 | 39 |
| Silenced | 60 | 34 to 39 |

One seed each. Every circuit memorises the two training plates, because a constant turn that happens to pass the food scores well there. Only the held out plates tell the circuits apart, and there the real wiring did better. More seeds are needed before calling this a result.

A limitation found on the way: in this uniform spiking model the worm's head circuit (RIA and the head motor neurons RMD and SMD) locks into persistent firing at 250 to 300 Hz after a strong input and stops carrying information. Real worm neurons are mostly graded and do not do this, so those neurons are not used as readouts.
