"""Import the real FlyWire fruit fly brain from Codex exports.

1. Create a free account at https://codex.flywire.ai and open the download page.
2. Put these files into data/raw/flywire/:
       neurons.csv.gz          root_id, group, nt_type, nt_type_score
       classification.csv.gz   root_id, flow, super_class, class, sub_class, cell_type, side
       connections.csv.gz      pre_root_id, post_root_id, neuropil, syn_count, nt_type
                               (connections_princeton.csv.gz also works)
3. python pipeline/import_flywire.py --min-syn 5

The output goes to data/species/fruit-fly-flywire/ (ignored by git, it is large).
The same importer reads MaleCNS style exports thanks to the column aliases below.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

from common import ROOT, write_species

ALIASES = {
    "bodyId": "root_id", "bodyid": "root_id", "nt_type_score": "nt_score",
    "ntTypeScore": "nt_score", "neurotransmitter": "nt_type", "predictedNt": "nt_type",
    "weight": "syn_count", "syn_cnt": "syn_count", "bodyId_pre": "pre_root_id",
    "bodyId_post": "post_root_id", "roi": "neuropil", "type": "cell_type",
    "superclass": "super_class",
}

META = {
    "common_name": "Fruit fly (FlyWire, real)",
    "latin_name": "Drosophila melanogaster",
    "status": "import",
    "summary": ("The complete adult female fly brain: about 140,000 neurons and 50 million "
                "synapses, reconstructed from electron microscopy by the FlyWire consortium."),
    "dataset": "FlyWire FAFB connectome via Codex",
    "source_url": "https://codex.flywire.ai",
    "license": "FlyWire data terms of use apply. Not redistributed in this repository.",
    "citations": [
        "Dorkenwald, S. et al. (2024). Neuronal wiring diagram of an adult brain. Nature 634, 124-138.",
        "Schlegel, P. et al. (2024). Whole-brain annotation and multi-connectome cell typing of Drosophila. Nature 634, 139-152.",
        "Eckstein, N. et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila melanogaster. Cell 187, 2574-2594.",
    ],
    "caveats": [
        "Transmitter types are predictions from images, with a confidence score.",
        "Too large for in-browser simulation; use the SQL layer or a server side run.",
    ],
    "sign": {"ACH": 1, "GABA": -1, "GLUT": -1, "DA": 0, "SER": 0, "OCT": 0, "": 0},
    "sim": {
        "duration_ms": 1000, "dt_ms": 0.1, "v_rest": -52, "v_reset": -52, "v_th": -45,
        "tau_m_ms": 20, "t_ref_ms": 2.2, "tau_syn_ms": 5, "delay_ms": 1.8,
        "w_syn_mv": 0.275, "g_gap": 0, "input_rate_hz": 150, "input_w_mv": 68.75,
    },
    "readouts": [
        {"id": "escape", "label": "Escape take off",
         "description": "Giant Fiber (DNp01) firing.",
         "positive": {"label": "Giant Fiber", "cell_types": ["DNp01"]}},
    ],
    "presets": [
        {"id": "looming", "label": "Looming object",
         "description": "Stimulate the looming detectors LC4 and LPLC2.",
         "stimulate": [{"cell_type": "LC4"}, {"cell_type": "LPLC2"}], "lesion": [],
         "expected": "Giant Fiber fires"},
    ],
}


def find(directory: Path, *names: str) -> Path:
    for n in names:
        for candidate in (directory / n, directory / f"{n}.gz"):
            if candidate.exists():
                return candidate
    sys.exit(f"Missing file in {directory}: one of {names}")


def rename(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(columns={k: v for k, v in ALIASES.items() if k in df.columns})


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default=str(ROOT / "data" / "raw" / "flywire"))
    ap.add_argument("--species-id", default="fruit-fly-flywire")
    ap.add_argument("--min-syn", type=int, default=5)
    args = ap.parse_args()
    d = Path(args.dir)

    neurons = rename(pd.read_csv(find(d, "neurons.csv")))
    classes = rename(pd.read_csv(find(d, "classification.csv")))
    neurons = neurons[["root_id"] + [c for c in ("nt_type", "nt_score") if c in neurons]]
    neurons = neurons.merge(classes, on="root_id", how="left").drop_duplicates("root_id")
    conns = rename(pd.read_csv(find(d, "connections.csv", "connections_princeton.csv",
                                    "connections_no_threshold.csv")))
    conns = conns[conns["syn_count"] >= args.min_syn]
    conns = conns.groupby(["pre_root_id", "post_root_id", "neuropil"], as_index=False)[
        "syn_count"].sum()
    known = set(neurons["root_id"])
    conns = conns[conns.pre_root_id.isin(known) & conns.post_root_id.isin(known)]

    def col(row, name):
        v = row.get(name)
        return "" if pd.isna(v) else v

    write_species(
        args.species_id, META,
        [{"neuron_id": str(r["root_id"]), "super_class": col(r, "super_class"),
          "class": col(r, "class"), "cell_type": col(r, "cell_type"),
          "side": col(r, "side"), "nt_type": str(col(r, "nt_type")).upper(),
          "nt_score": col(r, "nt_score")} for r in neurons.to_dict("records")],
        [{"pre_id": str(r["pre_root_id"]), "post_id": str(r["post_root_id"]),
          "region": r["neuropil"], "syn_type": "chemical", "syn_count": int(r["syn_count"])}
         for r in conns.to_dict("records")],
        large=True)


if __name__ == "__main__":
    main()
