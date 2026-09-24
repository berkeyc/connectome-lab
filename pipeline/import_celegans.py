"""Import the C. elegans hermaphrodite connectome.

Anatomy:          Cook et al. 2019 (chemical synapses and gap junctions, 302 neurons)
Transmitters:     Wang et al. 2024 neurotransmitter atlas
Both are read through the OpenWorm ConnectomeToolbox (cect, MIT licence):

    pip install cect            # or: git clone https://github.com/openworm/ConnectomeToolbox
    python pipeline/import_celegans.py
"""

from __future__ import annotations

import os
import sys
from collections import Counter, defaultdict

from common import write_species

if os.environ.get("CECT_PATH"):
    sys.path.insert(0, os.environ["CECT_PATH"])

try:
    from cect.Cells import (get_SIM_class, get_short_description, is_bilateral_left,
                            is_bilateral_right, remove_leading_index_zero)
    from cect.readers.Cook2019HermReader import get_instance as cook2019
    from cect.readers.Wang2024HermReader import get_instance as wang2024
except ImportError:
    sys.exit("Install the OpenWorm ConnectomeToolbox first: pip install cect "
             "(or set CECT_PATH to a clone of it)")

SPECIES_ID = "c-elegans"

NT_CODE = {"Acetylcholine": "ACH", "Glutamate": "GLUT", "GABA": "GABA", "Betaine": "BET"}
SIM_TO_SUPER = {"Sensory": "sensory", "Interneuron": "interneuron",
                "Motorneuron": "motor", "Other": "other"}

# ventral cord motor neuron classes are numbered (VA1..VA12); group them
CORD_CLASSES = ("VA", "VB", "VC", "VD", "DA", "DB", "DD", "AS")


def cell_type(name: str) -> str:
    base = remove_leading_index_zero(name)
    for prefix in CORD_CLASSES:
        if base.startswith(prefix) and base[len(prefix):].isdigit():
            return prefix
    if is_bilateral_left(base) or is_bilateral_right(base):
        return base[:-1]
    return base


def side(name: str) -> str:
    base = remove_leading_index_zero(name)
    if is_bilateral_left(base):
        return "left"
    if is_bilateral_right(base):
        return "right"
    return "center"


META = {
    "common_name": "Nematode worm",
    "latin_name": "Caenorhabditis elegans",
    "status": "real",
    "summary": ("The first animal whose entire nervous system was mapped. 302 neurons, "
                "wired almost identically in every individual, controlling crawling, "
                "feeding, egg laying and escape."),
    "dataset": "Cook et al. 2019 hermaphrodite connectome with Wang et al. 2024 transmitter atlas",
    "source_url": "https://github.com/openworm/ConnectomeToolbox",
    "license": "Data redistributed by OpenWorm ConnectomeToolbox (MIT). Cite the original papers.",
    "citations": [
        "Cook, S. J. et al. (2019). Whole-animal connectomes of both Caenorhabditis elegans sexes. Nature 571, 63-71.",
        "Wang, C. et al. (2024). A neurotransmitter atlas of C. elegans males and hermaphrodites. eLife 13, RP95402.",
        "Gleeson, P. et al. ConnectomeToolbox, OpenWorm. https://github.com/openworm/ConnectomeToolbox",
    ],
    "caveats": [
        "Most C. elegans neurons are graded, not spiking. The lab uses the same spiking model as for flies, a strong simplification. Some reflexes (nose touch) are reproduced, others (tail touch) are not.",
        "Glutamate can excite or inhibit depending on the receptor. It is treated as excitatory here because the classic touch and escape reflexes (ASH, FLP, PLM onto command interneurons) use excitatory glutamate receptors. Some synapses, such as AWC onto AIY, are actually inhibitory.",
        "Gap junctions are modelled as simple electrical coupling with one shared strength.",
    ],
    "sign": {"ACH": 1, "GABA": -1, "GLUT": 1, "BET": 0, "": 0},
    "sim": {
        "duration_ms": 1000, "dt_ms": 0.1, "v_rest": -52, "v_reset": -52, "v_th": -45,
        "tau_m_ms": 20, "t_ref_ms": 2.2, "tau_syn_ms": 5, "delay_ms": 1.8,
        "w_syn_mv": 0.7, "g_gap": 0.002, "input_rate_hz": 150, "input_w_mv": 68.75,
    },
    "readouts": [
        {"id": "direction", "label": "Crawling direction",
         "description": "Forward command neurons minus backward command neurons.",
         "positive": {"label": "forward", "cell_types": ["AVB", "PVC", "VB", "DB"]},
         "negative": {"label": "backward", "cell_types": ["AVA", "AVD", "AVE", "VA", "DA"]}},
        {"id": "head", "label": "Head turning",
         "description": "Dorsal minus ventral head motor neurons.",
         "positive": {"label": "dorsal", "cell_types": ["RMDD", "SMDD"]},
         "negative": {"label": "ventral", "cell_types": ["RMDV", "SMDV"]}},
    ],
    "presets": [
        {"id": "nose-touch", "label": "Touch the nose",
         "description": "Stimulate the nose touch and pain sensors ASH and FLP. Real worms reverse.",
         "stimulate": [{"cell_type": "ASH"}, {"cell_type": "FLP"}], "lesion": [],
         "expected": "In real worms: the animal reverses (crawling direction below zero)."},
        {"id": "tail-touch", "label": "Touch the tail",
         "description": "Stimulate the posterior touch receptors PLM. Real worms speed forward.",
         "stimulate": [{"cell_type": "PLM"}], "lesion": [],
         "expected": "In real worms: the animal speeds forward. Does the wiring alone reproduce this?"},
        {"id": "head-touch-no-ava", "label": "Nose touch without AVA",
         "description": "Same nose touch, but the backward command interneuron AVA is removed, as in classic laser ablation experiments.",
         "stimulate": [{"cell_type": "ASH"}, {"cell_type": "FLP"}], "lesion": [{"cell_type": "AVA"}],
         "expected": "In real worms: reversals become rare and slow."},
        {"id": "gentle-body-touch", "label": "Gentle touch on the body",
         "description": "Stimulate the anterior gentle touch receptors ALM and AVM.",
         "stimulate": [{"cell_type": "ALM"}, {"cell_type": "AVM"}], "lesion": [],
         "expected": "In real worms: the animal reverses. Does the wiring alone reproduce this?"},
    ],
}


def main():
    names, conns = cook2019().read_data()
    _, nt_conns = wang2024().read_data()

    nt_votes: dict[str, Counter] = defaultdict(Counter)
    for c in nt_conns:
        if c.syntype == "Chemical" and c.synclass in NT_CODE:
            nt_votes[c.pre_cell][NT_CODE[c.synclass]] += 1

    neurons = []
    for n in sorted(names):
        votes = nt_votes.get(n)
        nt, score = ("", "")
        if votes:
            nt, top = votes.most_common(1)[0]
            score = round(top / sum(votes.values()), 2)
        neurons.append({
            "neuron_id": n,
            "super_class": SIM_TO_SUPER.get(get_SIM_class(remove_leading_index_zero(n)), "other"),
            "class": get_short_description(remove_leading_index_zero(n)).replace("???", ""),
            "cell_type": cell_type(n), "side": side(n), "nt_type": nt, "nt_score": score,
        })

    rows: dict[tuple, float] = defaultdict(float)
    for c in conns:
        kind = "chemical" if c.syntype == "Chemical" else "electrical"
        rows[(c.pre_cell, c.post_cell, kind)] += c.number
    out = [{"pre_id": a, "post_id": b, "region": "all", "syn_type": k,
            "syn_count": int(round(v))}
           for (a, b, k), v in sorted(rows.items()) if v > 0]

    write_species(SPECIES_ID, META, neurons, out)


if __name__ == "__main__":
    main()
