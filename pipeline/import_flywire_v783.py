"""Import the real FlyWire fruit fly brain (materialization 783).

Connectivity: Shiu et al. (2024, Nature) model repository, which redistributes
the FlyWire v783 connectivity table (15 million neuron pairs, 54 million synapses).
Annotations: Schlegel et al. (2024, Nature) FlyWire annotations (cell types,
super classes, sides, predicted neurotransmitters).

    python pipeline/import_flywire_v783.py          # downloads ~135 MB on first run

Outputs
    data/species/fruit-fly-flywire/        the whole brain, for the local runner (not committed)
    species/<circuit-id>/                   real subcircuits small enough for the browser

Licence: FlyWire data are released under CC BY-NC 4.0 (flywire.ai/guidelines; the
Zenodo release of v783 is labelled CC BY 4.0). Attribute FlyWire and cite the papers
in species.json. The circuits committed here are unmodified subsets of that data.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from common import ROOT, SPECIES_DIR, write_species

RAW = ROOT / "data" / "raw" / "flywire"
FILES = {
    "Connectivity_783.parquet": "https://raw.githubusercontent.com/philshiu/Drosophila_brain_model/main/Connectivity_783.parquet",
    "Supplemental_file1_neuron_annotations.tsv": "https://raw.githubusercontent.com/flyconnectome/flywire_annotations/main/supplemental_files/Supplemental_file1_neuron_annotations.tsv",
}
NT_CODE = {"acetylcholine": "ACH", "gaba": "GABA", "glutamate": "GLUT", "dopamine": "DA",
           "serotonin": "SER", "octopamine": "OCT"}
SUPER = {"sensory_ascending": "ascending", "visual_centrifugal": "central", "endocrine": "other"}

CITATIONS = [
    "Dorkenwald, S. et al. (2024). Neuronal wiring diagram of an adult brain. Nature 634, 124-138.",
    "Schlegel, P. et al. (2024). Whole-brain annotation and multi-connectome cell typing of Drosophila. Nature 634, 139-152.",
    "Shiu, P. K. et al. (2024). A Drosophila computational brain model reveals sensorimotor processing. Nature 634, 210-219.",
    "Eckstein, N. et al. (2024). Neurotransmitter classification from electron microscopy images at synaptic sites in Drosophila melanogaster. Cell 187, 2574-2594.",
]
LICENSE = ("FlyWire connectome v783, CC BY-NC 4.0 (flywire.ai/guidelines). Connectivity table via "
           "github.com/philshiu/Drosophila_brain_model, annotations via github.com/flyconnectome/flywire_annotations.")
SIGN = {"ACH": 1, "DA": 1, "SER": 1, "OCT": 1, "GABA": -1, "GLUT": -1, "": 0}
# The published whole-brain model of Shiu et al. 2024, unchanged.
SHIU_SIM = {
    "duration_ms": 1000, "dt_ms": 0.1, "v_rest": -52, "v_reset": -52, "v_th": -45,
    "tau_m_ms": 20, "t_ref_ms": 2.2, "tau_syn_ms": 5, "delay_ms": 1.8,
    "w_syn_mv": 0.275, "g_gap": 0, "input_rate_hz": 150, "input_w_mv": 68.75,
}
COMMON_CAVEATS = [
    "Wiring, cell types and transmitters are measured or predicted from electron microscopy. Dynamics use the published leaky integrate and fire model of Shiu et al. (2024): identical neurons, weights proportional to synapse counts, sign from the predicted transmitter.",
    "Transmitter identities are predictions. Glutamate is treated as inhibitory, as in the published model.",
]

# Subcircuits cut out of the whole brain: every input and output neuron, plus the
# neurons that sit on strong paths (at least `min_syn` synapses per step) between them.
CIRCUITS = [
    {
        "id": "fly-escape-circuit",
        "common_name": "Fruit fly escape circuit (FlyWire)",
        "summary": "The real looming escape pathway of the adult fly brain: 314 looming detectors (LC4, LPLC2), the Giant Fiber and the neurons between them, cut out of FlyWire with every measured synapse.",
        "inputs": ["LC4", "LPLC2"],
        "outputs": ["DNp01", "DNp02", "DNp04", "DNp06", "DNp11"],
        "min_syn": 20,
        "readouts": [
            {"id": "escape", "label": "Giant Fiber", "description": "Firing of DNp01, the Giant Fiber that triggers take off.",
             "positive": {"label": "Giant Fiber", "cell_types": ["DNp01"]}},
            {"id": "escape_side", "label": "Giant Fiber, right minus left",
             "description": "Asymmetry between the right and left Giant Fiber.",
             "positive": {"label": "right", "cell_types": ["DNp01"], "side": "right"},
             "negative": {"label": "left", "cell_types": ["DNp01"], "side": "left"}},
        ],
        "presets": [
            {"id": "looming-right", "label": "Looming object from the right",
             "description": "Stimulate the right LC4 and LPLC2 looming detectors.",
             "stimulate": [{"cell_type": "LC4", "side": "right"}, {"cell_type": "LPLC2", "side": "right"}], "lesion": [],
             "expected": "In real flies: Giant Fiber spikes and a fast take off."},
            {"id": "looming-no-lplc2", "label": "Looming without LPLC2",
             "description": "Same stimulus with LPLC2 silenced.",
             "stimulate": [{"cell_type": "LC4", "side": "right"}, {"cell_type": "LPLC2", "side": "right"}],
             "lesion": [{"cell_type": "LPLC2"}], "expected": "In real flies: Giant Fiber responses to looming shrink when LPLC2 is silenced (Ache et al. 2019)."},
            {"id": "lc4-only", "label": "Only LC4",
             "description": "Stimulate LC4 on both sides.",
             "stimulate": [{"cell_type": "LC4"}], "lesion": [], "expected": "LC4 alone can drive the Giant Fiber (von Reyn et al. 2017)."},
        ],
    },
    {
        "id": "fly-visuomotor-circuit",
        "common_name": "Fruit fly visuomotor circuit (FlyWire)",
        "summary": "Visual projection neurons that detect looming and moving objects, the descending neurons that steer, stop, reverse and escape, and the strongest paths between them. Used for training experiments.",
        "inputs": ["LC4", "LPLC2", "LPLC1", "LC16"],
        "outputs": ["DNa01", "DNa02", "DNa03", "DNb05", "DNa11", "DNp01", "MDN", "DNp09", "DNg13", "DNp03"],
        "min_syn": 40,
        "readouts": [
            {"id": "steer", "label": "DNa02, right minus left", "description": "Steering descending neurons.",
             "positive": {"label": "right", "cell_types": ["DNa02"], "side": "right"},
             "negative": {"label": "left", "cell_types": ["DNa02"], "side": "left"}},
            {"id": "backward", "label": "Moonwalker (MDN)", "description": "Backward walking command.",
             "positive": {"label": "MDN", "cell_types": ["MDN"]}},
        ],
        "presets": [
            {"id": "lc16", "label": "LC16 on both sides", "description": "LC16 activation makes real flies walk backwards (Wu et al. 2016).",
             "stimulate": [{"cell_type": "LC16"}], "lesion": [], "expected": "In real flies: backward walking."},
            {"id": "lplc1-right", "label": "LPLC1 right", "description": "Stimulate right LPLC1.",
             "stimulate": [{"cell_type": "LPLC1", "side": "right"}], "lesion": [], "expected": "See which descending neurons respond."},
        ],
    },
]


def download():
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        path = RAW / name
        if path.exists():
            continue
        print(f"downloading {name} ...")
        urllib.request.urlretrieve(url, path)


def load():
    conn = pd.read_parquet(RAW / "Connectivity_783.parquet",
                           columns=["Presynaptic_ID", "Postsynaptic_ID", "Connectivity"])
    ann = pd.read_csv(RAW / "Supplemental_file1_neuron_annotations.tsv", sep="\t", low_memory=False,
                      usecols=["root_id", "super_class", "cell_class", "cell_type", "side", "top_nt", "top_nt_conf"])
    ann = ann.drop_duplicates("root_id").set_index("root_id")
    ids = pd.Index(np.union1d(conn.Presynaptic_ID.unique(), conn.Postsynaptic_ID.unique()))
    ann = ann.reindex(ids)
    return conn, ann


def neuron_rows(ann: pd.DataFrame, keep=None):
    sub = ann if keep is None else ann.loc[sorted(keep)]
    sc = sub.super_class.fillna("other").map(lambda s: SUPER.get(s, s))
    rows = pd.DataFrame({
        "neuron_id": sub.index.astype(str),
        "super_class": sc.values,
        "class": sub.cell_class.fillna("").values,
        "cell_type": sub.cell_type.fillna("").values,
        "side": sub.side.fillna("center").values,
        "nt_type": sub.top_nt.map(lambda t: NT_CODE.get(t, "")).values,
        "nt_score": sub.top_nt_conf.round(2).values,
    })
    return rows.to_dict("records")


def conn_rows(conn: pd.DataFrame):
    return [{"pre_id": str(p), "post_id": str(q), "region": "all", "syn_type": "chemical", "syn_count": int(c)}
            for p, q, c in zip(conn.Presynaptic_ID.values, conn.Postsynaptic_ID.values, conn.Connectivity.values)]


def cut(conn, ann, spec):
    S = set(ann.index[ann.cell_type.isin(spec["inputs"])])
    O = set(ann.index[ann.cell_type.isin(spec["outputs"])])
    t = spec["min_syn"]

    def post(src):
        e = conn[conn.Presynaptic_ID.isin(src)].groupby("Postsynaptic_ID").Connectivity.sum()
        return set(e.index[e >= t])

    def pre(dst):
        e = conn[conn.Postsynaptic_ID.isin(dst)].groupby("Presynaptic_ID").Connectivity.sum()
        return set(e.index[e >= t])

    f1 = post(S)
    f2 = post(f1)
    b1 = pre(O)
    b2 = pre(b1)
    keep = S | O | (f1 & (b1 | b2)) | (f2 & b1)
    sub = conn[conn.Presynaptic_ID.isin(keep) & conn.Postsynaptic_ID.isin(keep)]
    return keep, sub


def main():
    download()
    conn, ann = load()
    print(f"FlyWire v783: {len(ann):,} neurons, {len(conn):,} connections, {conn.Connectivity.sum():,} synapses")

    full_meta = json.loads((SPECIES_DIR / "fruit-fly-flywire" / "species.json").read_text(encoding="utf-8"))
    full_meta.update({
        "common_name": "Fruit fly, whole brain (FlyWire)",
        "status": "import",
        "summary": ("The complete adult female fly brain: about 139,000 neurons and 54 million synapses, reconstructed from "
                    "electron microscopy by the FlyWire consortium. Runs on the local runner."),
        "dataset": "FlyWire connectome v783 with Schlegel et al. 2024 annotations",
        "source_url": "https://flywire.ai",
        "license": LICENSE, "citations": CITATIONS, "caveats": COMMON_CAVEATS + [
            "Too large for real time simulation in a browser; use the local runner."],
        "sign": SIGN, "sim": SHIU_SIM,
    })
    if "--skip-full" not in sys.argv:
        write_species("fruit-fly-flywire", full_meta, neuron_rows(ann), conn_rows(conn), large=True)

    for spec in CIRCUITS:
        keep, sub = cut(conn, ann, spec)
        meta = {
            "common_name": spec["common_name"], "latin_name": "Drosophila melanogaster", "status": "real",
            "parent": "fruit-fly-flywire", "summary": spec["summary"],
            "dataset": f"Subcircuit of FlyWire v783: inputs {', '.join(spec['inputs'])}; outputs {', '.join(spec['outputs'])}; paths with at least {spec['min_syn']} synapses per step",
            "source_url": "https://flywire.ai", "license": LICENSE, "citations": CITATIONS,
            "caveats": COMMON_CAVEATS + [
                "A subcircuit: neurons outside it are absent, so inputs they would provide are missing.",
                f"Selection: all {', '.join(spec['inputs'])} and {', '.join(spec['outputs'])} neurons, plus neurons on paths of one or two steps between them with at least {spec['min_syn']} synapses per step. Every synapse among the selected neurons is kept."],
            "sign": SIGN, "sim": SHIU_SIM, "readouts": spec["readouts"], "presets": spec["presets"],
            "circuit": {"inputs": spec["inputs"], "outputs": spec["outputs"], "min_syn": spec["min_syn"]},
        }
        write_species(spec["id"], meta, neuron_rows(ann, keep), conn_rows(sub))


if __name__ == "__main__":
    main()
