"""Synthetic fruit fly connectome for demos and tests.

The real FlyWire brain (about 140,000 neurons) needs a free Codex account to
download and is too large to simulate in a browser. This generator builds a
5,000 neuron stand in whose wiring follows the known big picture of the fly
(eye > optic lobe > central brain > descending neurons > motor neurons, plus
smell, memory, navigation, touch and escape circuits). Every number is invented.
Never draw biological conclusions from it.

    python pipeline/make_synthetic_fly.py
"""

from __future__ import annotations

import random

from common import write_species

SPECIES_ID = "fruit-fly-synthetic"

# (cell_type, super_class, flow, class, nt_type, count_per_side, home_neuropil)
CELL_TYPES = [
    # vision
    ("R1-6",   "sensory",    "afferent",  "visual",         "HA",   120, "LA"),
    ("L1",     "optic",      "intrinsic", "lamina",         "GLUT", 100, "LA"),
    ("L2",     "optic",      "intrinsic", "lamina",         "ACH",  100, "LA"),
    ("Mi1",    "optic",      "intrinsic", "medulla",        "ACH",  100, "ME"),
    ("Mi9",    "optic",      "intrinsic", "medulla",        "GLUT", 100, "ME"),
    ("Tm3",    "optic",      "intrinsic", "medulla",        "ACH",  100, "ME"),
    ("T4",     "optic",      "intrinsic", "motion",         "ACH",  160, "LOP"),
    ("T5",     "optic",      "intrinsic", "motion",         "ACH",  160, "LOP"),
    ("HS",     "optic",      "intrinsic", "LPTC",           "ACH",    3, "LOP"),
    ("VS",     "optic",      "intrinsic", "LPTC",           "ACH",    6, "LOP"),
    ("LC4",    "visual_projection", "intrinsic", "LC",      "ACH",   50, "LO"),
    ("LPLC2",  "visual_projection", "intrinsic", "LPLC",    "ACH",   80, "LOP"),
    # olfaction and memory
    ("ORN",    "sensory",    "afferent",  "olfactory",      "ACH",  200, "AL"),
    ("uPN",    "central",    "intrinsic", "ALPN",           "ACH",   60, "AL"),
    ("LN",     "central",    "intrinsic", "ALLN",           "GABA",  40, "AL"),
    ("KC",     "central",    "intrinsic", "Kenyon_Cell",    "ACH",  400, "MB_CA"),
    ("MBON",   "central",    "intrinsic", "MBON",           "GLUT",  20, "MB_ML"),
    ("PAM",    "central",    "intrinsic", "DAN",            "DA",    40, "MB_ML"),
    # navigation
    ("EPG",    "central",    "intrinsic", "CX",             "ACH",   23, "EB"),
    ("PEN",    "central",    "intrinsic", "CX",             "ACH",   20, "PB"),
    ("Delta7", "central",    "intrinsic", "CX",             "GLUT",  20, "PB"),
    ("PFL3",   "central",    "intrinsic", "CX",             "ACH",   12, "LAL"),
    # mechanosensation
    ("JO",     "sensory",    "afferent",  "mechanosensory", "ACH",   80, "AMMC"),
    ("BM",     "sensory",    "afferent",  "mechanosensory", "ACH",   60, "GNG"),
    # descending neurons (brain -> nerve cord)
    ("GF",     "descending", "efferent",  "DN",             "ACH",    1, "GNG"),
    ("MDN",    "descending", "efferent",  "DN",             "ACH",    2, "GNG"),
    ("DNa02",  "descending", "efferent",  "DN",             "ACH",    1, "LAL"),
    ("DNg",    "descending", "efferent",  "DN",             "GABA",  30, "GNG"),
    ("DNp",    "descending", "efferent",  "DN",             "ACH",   30, "SPS"),
    # motor and ascending
    ("MN_leg",  "motor",     "efferent",  "leg_motor",      "ACH",   40, "GNG"),
    ("MN_wing", "motor",     "efferent",  "wing_motor",     "ACH",   20, "GNG"),
    ("AN",      "ascending", "afferent",  "AN",             "ACH",   40, "GNG"),
    # generic central brain
    ("CB",      "central",   "intrinsic", "unknown",        "ACH",  250, "SLP"),
    ("CB_inh",  "central",   "intrinsic", "unknown",        "GABA", 150, "SMP"),
]

# (pre_type, post_type, probability, mean_synapses, neuropil)
WIRING = [
    ("R1-6", "L1", 0.05, 40, "LA"), ("R1-6", "L2", 0.05, 40, "LA"),
    ("L1", "Mi1", 0.04, 20, "ME"), ("L1", "Mi9", 0.02, 10, "ME"),
    ("L2", "Tm3", 0.04, 20, "ME"), ("L2", "Mi9", 0.03, 15, "ME"),
    ("Mi1", "T4", 0.05, 15, "ME"), ("Mi9", "T4", 0.04, 12, "ME"),
    ("Tm3", "T5", 0.05, 15, "LO"), ("Tm3", "LC4", 0.03, 8, "LO"),
    ("T4", "HS", 0.40, 12, "LOP"), ("T5", "HS", 0.40, 12, "LOP"),
    ("T4", "VS", 0.30, 10, "LOP"), ("T5", "VS", 0.30, 10, "LOP"),
    ("T4", "LPLC2", 0.03, 8, "LOP"), ("T5", "LPLC2", 0.03, 8, "LOP"),
    ("LC4", "GF", 1.00, 60, "PVLP"), ("LPLC2", "GF", 1.00, 40, "PVLP"),
    ("HS", "DNp", 0.30, 20, "IPS"), ("VS", "DNp", 0.30, 20, "IPS"),
    ("ORN", "uPN", 0.10, 30, "AL"), ("ORN", "LN", 0.05, 10, "AL"),
    ("LN", "uPN", 0.20, 15, "AL"), ("LN", "ORN", 0.02, 5, "AL"),
    ("uPN", "KC", 0.12, 6, "MB_CA"), ("uPN", "CB", 0.05, 8, "LH"),
    ("KC", "MBON", 0.30, 8, "MB_ML"), ("PAM", "MBON", 0.30, 12, "MB_ML"),
    ("PAM", "KC", 0.05, 4, "MB_ML"),
    ("MBON", "CB", 0.10, 15, "SMP"), ("MBON", "PAM", 0.10, 10, "SMP"),
    ("EPG", "PEN", 0.30, 20, "PB"), ("PEN", "EPG", 0.30, 20, "EB"),
    ("EPG", "Delta7", 0.40, 15, "PB"), ("Delta7", "EPG", 0.30, 15, "PB"),
    ("EPG", "PFL3", 0.30, 15, "PB"), ("PFL3", "DNa02", 1.00, 50, "LAL"),
    ("CB", "EPG", 0.02, 6, "EB"),
    ("JO", "CB", 0.03, 10, "AMMC"), ("JO", "GF", 0.20, 15, "AMMC"),
    ("BM", "DNg", 0.10, 12, "GNG"), ("BM", "MDN", 0.20, 10, "GNG"),
    ("CB", "CB", 0.01, 5, "SLP"), ("CB", "CB_inh", 0.02, 6, "SMP"),
    ("CB_inh", "CB", 0.03, 8, "SMP"), ("CB", "DNp", 0.01, 6, "SPS"),
    ("CB", "DNg", 0.01, 6, "GNG"), ("CB", "MDN", 0.02, 8, "GNG"),
    ("GF", "MN_leg", 0.50, 80, "GNG"), ("GF", "MN_wing", 0.50, 60, "GNG"),
    ("MDN", "MN_leg", 0.60, 40, "GNG"), ("DNa02", "MN_leg", 0.40, 30, "GNG"),
    ("DNp", "MN_wing", 0.20, 15, "GNG"), ("DNg", "MN_leg", 0.10, 10, "GNG"),
    ("MN_leg", "AN", 0.05, 5, "GNG"), ("AN", "CB", 0.03, 8, "GNG"),
    ("AN", "DNg", 0.05, 8, "GNG"),
]

SIDES = ("left", "right")


def generate(seed: int):
    rng = random.Random(seed)
    neurons, by_type = [], {}
    next_id = 720575940600000000  # same 18 digit shape as FlyWire root ids

    for ctype, sclass, flow, klass, nt, count, _ in CELL_TYPES:
        for side in SIDES:
            for _ in range(count):
                next_id += rng.randint(1, 999)
                row = {
                    "root_id": next_id, "flow": flow, "super_class": sclass,
                    "class": klass, "sub_class": "", "cell_type": ctype,
                    "side": side, "nt_type": nt,
                    "nt_score": round(rng.uniform(0.6, 0.99), 2),
                }
                neurons.append(row)
                by_type.setdefault((ctype, side), []).append(row)

    nt_of = {n["root_id"]: n["nt_type"] for n in neurons}
    conns: dict[tuple, int] = {}

    def add(pre, post, syn, pil):
        if pre == post:
            return
        key = (pre, post, pil)
        conns[key] = conns.get(key, 0) + syn

    for pre_t, post_t, p, mean_syn, pil in WIRING:
        for side in SIDES:
            # mostly ipsilateral, with some crossing to the other side
            for post_side, scale in ((side, 1.0), (SIDES[1 - SIDES.index(side)], 0.15)):
                for a in by_type.get((pre_t, side), []):
                    for b in by_type.get((post_t, post_side), []):
                        if rng.random() < p * scale:
                            syn = max(1, int(rng.expovariate(1 / mean_syn)))
                            add(a["root_id"], b["root_id"], syn, pil)

    return neurons, [
        {"pre_root_id": a, "post_root_id": b, "neuropil": pil,
         "syn_count": s, "nt_type": nt_of[a]}
        for (a, b, pil), s in conns.items()
    ]



META = {
    "common_name": "Fruit fly (synthetic demo)",
    "latin_name": "Drosophila melanogaster",
    "status": "synthetic",
    "summary": ("A 5,000 neuron stand in for the fly brain with realistic circuit layout "
                "(vision, smell, memory, navigation, escape) and invented numbers. "
                "Fast enough to experiment with in the browser."),
    "dataset": "Generated by pipeline/make_synthetic_fly.py (seed 42)",
    "source_url": "https://codex.flywire.ai",
    "license": "Generated data, MIT",
    "citations": [
        "Circuit layout inspired by: Dorkenwald, S. et al. (2024). Neuronal wiring diagram of an adult brain. Nature 634, 124-138.",
        "Simulation parameters from: Shiu, P. K. et al. (2024). A Drosophila computational brain model reveals sensorimotor processing. Nature 634, 210-219.",
    ],
    "caveats": [
        "Synthetic data. Cell type names are real, the wiring numbers are invented.",
        "Use the FlyWire importer to run the same experiments on the real brain.",
    ],
    "sign": {"ACH": 1, "GABA": -1, "GLUT": -1, "HA": -1, "DA": 0, "SER": 0, "OCT": 0, "": 0},
    "sim": {
        "duration_ms": 1000, "dt_ms": 0.1, "v_rest": -52, "v_reset": -52, "v_th": -45,
        "tau_m_ms": 20, "t_ref_ms": 2.2, "tau_syn_ms": 5, "delay_ms": 1.8,
        "w_syn_mv": 0.275, "g_gap": 0, "input_rate_hz": 150, "input_w_mv": 68.75,
    },
    "readouts": [
        {"id": "escape", "label": "Escape take off",
         "description": "Firing of the Giant Fiber, the neuron that triggers the jump.",
         "positive": {"label": "Giant Fiber", "cell_types": ["GF"]}},
        {"id": "steer", "label": "Steering",
         "description": "Right minus left DNa02, the descending neurons that steer walking.",
         "positive": {"label": "right", "cell_types": ["DNa02"], "side": "right"},
         "negative": {"label": "left", "cell_types": ["DNa02"], "side": "left"}},
        {"id": "backward", "label": "Backward walking",
         "description": "Firing of the moonwalker descending neurons (MDN).",
         "positive": {"label": "MDN", "cell_types": ["MDN"]}},
    ],
    "presets": [
        {"id": "looming", "label": "Looming object",
         "description": "Something approaches fast from the right. Stimulate the looming detectors LC4 and LPLC2.",
         "stimulate": [{"cell_type": "LC4", "side": "right"}, {"cell_type": "LPLC2", "side": "right"}],
         "lesion": [], "expected": "Giant Fiber fires, the fly escapes"},
        {"id": "looming-no-lplc2", "label": "Looming without LPLC2",
         "description": "Same threat, but LPLC2 neurons are silenced.",
         "stimulate": [{"cell_type": "LC4", "side": "right"}, {"cell_type": "LPLC2", "side": "right"}],
         "lesion": [{"cell_type": "LPLC2"}], "expected": "escape drive drops"},
        {"id": "bristle", "label": "Touch the head bristles",
         "description": "Stimulate bristle mechanosensory neurons (BM).",
         "stimulate": [{"cell_type": "BM"}], "lesion": [], "expected": "backward walking"},
        {"id": "smell", "label": "Smell an odour",
         "description": "Stimulate olfactory receptor neurons (ORN) and watch memory output neurons (MBON).",
         "stimulate": [{"cell_type": "ORN"}], "lesion": [], "expected": "MBON activity, little motor output"},
        {"id": "compass", "label": "Kick the compass",
         "description": "Stimulate the central complex compass neurons (EPG) on the right.",
         "stimulate": [{"cell_type": "EPG", "side": "right"}], "lesion": [],
         "expected": "a steering bias through PFL3 and DNa02"},
    ],
}


def main():
    neurons, conns = generate(42)
    write_species(
        SPECIES_ID, META,
        [{"neuron_id": str(n["root_id"]), "super_class": n["super_class"], "class": n["class"],
          "cell_type": n["cell_type"], "side": n["side"], "nt_type": n["nt_type"],
          "nt_score": n["nt_score"]} for n in neurons],
        [{"pre_id": str(c["pre_root_id"]), "post_id": str(c["post_root_id"]),
          "region": c["neuropil"], "syn_type": "chemical", "syn_count": c["syn_count"]}
         for c in conns])


if __name__ == "__main__":
    main()
