# Adding a species

Every nervous system in the library uses the same three files. Once your dataset is in this format, the SQL layer, the species page and the lab work without any other change.

## 1. Write an importer

Create `pipeline/import_<name>.py`. It reads the published files and calls `write_species()` from `pipeline/common.py`:

```python
from common import write_species

write_species("my-species", META, neurons, connections)          # small, committed
write_species("my-species", META, neurons, connections, large=True)  # big, written to data/
```

`neurons` is a list of dicts:

| column | meaning |
|---|---|
| `neuron_id` | unique text id |
| `super_class` | one of `sensory`, `optic`, `visual_projection`, `interneuron`, `central`, `descending`, `ascending`, `motor`, `other` |
| `class` | finer class, free text |
| `cell_type` | the name people use in experiments; bilateral pairs share one type |
| `side` | `left`, `right` or `center` |
| `nt_type` | transmitter code such as `ACH`, `GABA`, `GLUT` (empty if unknown) |
| `nt_score` | confidence between 0 and 1, if available |

`connections` is a list of dicts with `pre_id`, `post_id`, `region` (neuropil, or `all`), `syn_type` (`chemical` or `electrical`) and `syn_count`.

## 2. Describe it in META

`META` becomes `species/<id>/species.json`. Look at `pipeline/import_celegans.py` for a full example.

* `common_name`, `latin_name`, `status` (`real`, `synthetic`, `import`), `summary`, `dataset`, `source_url`, `license`
* `citations` and `caveats`: shown on the species page. Be honest about what the model cannot do.
* `sign`: transmitter code to +1, -1 or 0. This is a modelling choice, so explain it in the caveats.
* `sim`: model parameters. Start from the worm or fly values.
* `readouts`: behaviour proxies computed from firing rates, as `positive` and optional `negative` groups of cell types.
* `presets`: classic experiments with `stimulate`, `lesion` and what happens `expected` in the real animal.

## 3. Build and check

```bash
python pipeline/import_<name>.py
python pipeline/build_web_bundle.py
cd web && npm run check:presets    # runs every preset on real and control brains
npm run dev
```

Tune `sim.w_syn_mv` until presets give clear responses without the whole network saturating, then check that the real brain differs from the controls. If a preset fails, keep it and say so: a documented miss is useful.

## 4. Open a pull request

Include the importer, the generated `species/<id>/` folder if it is under a few MB and the licence allows redistribution, and a line in the README table.
