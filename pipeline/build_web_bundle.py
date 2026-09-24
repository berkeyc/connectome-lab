"""Build the static data bundles the website reads.

    python pipeline/build_web_bundle.py

For every species with data:
    web/public/data/species/<id>/graph.json     compact graph for in-browser simulation
    web/public/data/species/<id>/summary.json   precomputed stats for the species page
and one web/public/data/library.json listing every species (including planned ones).
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict

from common import ROOT, list_species, read_species

OUT = ROOT / "web" / "public" / "data"
MAX_BROWSER_NEURONS = 20000  # bigger brains are listed, but simulated server side later

# Datasets on the roadmap. Shown in the library as "coming", never as available.
PLANNED = [
    {"id": "fruit-fly-larva", "common_name": "Fruit fly larva", "latin_name": "Drosophila melanogaster (larva)", "status": "planned",
     "summary": "The complete larval brain: 3,016 neurons with a fully mapped learning centre.",
     "dataset": "Winding, M. et al. (2023). The connectome of an insect brain. Science 379, eadd9330."},
    {"id": "fruit-fly-male-cns", "common_name": "Fruit fly, male CNS", "latin_name": "Drosophila melanogaster (male)", "status": "planned",
     "summary": "Brain plus nerve cord of the male fly, about 166,000 neurons, released in 2026.",
     "dataset": "MaleCNS v1.0, Janelia FlyEM, Cambridge Connectomics and Google Research (2026)."},
    {"id": "ciona-larva", "common_name": "Sea squirt larva", "latin_name": "Ciona intestinalis", "status": "planned",
     "summary": "A tadpole shaped relative of vertebrates with 177 central neurons.",
     "dataset": "Ryan, K. et al. (2016). The CNS connectome of a tadpole larva of Ciona intestinalis. eLife 5, e16962."},
    {"id": "mouse-v1-microns", "common_name": "Mouse visual cortex", "latin_name": "Mus musculus", "status": "planned",
     "summary": "A cubic millimetre of mouse visual cortex with functional recordings of the same neurons.",
     "dataset": "MICrONS Consortium (2025). Functional connectomics spanning multiple areas of mouse visual cortex. Nature."},
    {"id": "human-h01", "common_name": "Human cortex fragment", "latin_name": "Homo sapiens", "status": "planned",
     "summary": "A cubic millimetre of human temporal cortex: about 57,000 cells and 150 million synapses.",
     "dataset": "Shapson-Coe, A. et al. (2024). A petavoxel fragment of human cerebral cortex reconstructed at nanoscale resolution. Science 384, eadk4858."},
]

SIDE = {"left": 0, "right": 1}


def build(species_id: str):
    meta, neurons, conns = read_species(species_id)
    index = {n["neuron_id"]: i for i, n in enumerate(neurons)}
    types = sorted({n["cell_type"] or "unknown" for n in neurons})
    classes = sorted({n["super_class"] or "other" for n in neurons})
    nts = sorted({n["nt_type"] or "" for n in neurons})
    t_idx = {t: i for i, t in enumerate(types)}
    c_idx = {c: i for i, c in enumerate(classes)}
    nt_idx = {t: i for i, t in enumerate(nts)}

    chem = defaultdict(int)
    gap = defaultdict(int)
    for c in conns:
        key = (index[c["pre_id"]], index[c["post_id"]])
        (chem if c["syn_type"] == "chemical" else gap)[key] += int(c["syn_count"])

    out_dir = OUT / "species" / species_id
    out_dir.mkdir(parents=True, exist_ok=True)
    browser_ok = len(neurons) <= MAX_BROWSER_NEURONS
    if browser_ok:
        graph = {
            "id": species_id,
            "neuronIds": [n["neuron_id"] for n in neurons],
            "types": types, "classes": classes, "nts": nts,
            "type": [t_idx[n["cell_type"] or "unknown"] for n in neurons],
            "cls": [c_idx[n["super_class"] or "other"] for n in neurons],
            "side": [SIDE.get(n["side"], 2) for n in neurons],
            "nt": [nt_idx[n["nt_type"] or ""] for n in neurons],
            "chem": {"pre": [a for a, _ in chem], "post": [b for _, b in chem],
                     "w": list(chem.values())},
            "gap": {"pre": [a for a, _ in gap], "post": [b for _, b in gap],
                    "w": list(gap.values())},
        }
        (out_dir / "graph.json").write_text(json.dumps(graph, separators=(",", ":")))

    # --- summary for the species page -------------------------------------
    cls_of = [n["super_class"] or "other" for n in neurons]
    flow = defaultdict(int)
    syn_in = Counter()
    syn_out = Counter()
    for (a, b), w in list(chem.items()) + list(gap.items()):
        flow[(cls_of[a], cls_of[b])] += w
        syn_out[a] += w
        syn_in[b] += w
    order = [c for c in ["sensory", "optic", "visual_projection", "interneuron", "central",
                         "descending", "ascending", "motor", "other"] if c in classes]
    order += [c for c in classes if c not in order]

    by_type = defaultdict(list)
    for i, n in enumerate(neurons):
        by_type[n["cell_type"] or "unknown"].append(i)
    type_rows = []
    for t, idx in by_type.items():
        nt = Counter(neurons[i]["nt_type"] or "?" for i in idx).most_common(1)[0][0]
        type_rows.append({
            "type": t, "cls": cls_of[idx[0]], "n": len(idx), "nt": nt,
            "in_syn": sum(syn_in[i] for i in idx), "out_syn": sum(syn_out[i] for i in idx),
        })
    type_rows.sort(key=lambda r: -(r["in_syn"] + r["out_syn"]))

    hubs = sorted(range(len(neurons)), key=lambda i: -(syn_in[i] + syn_out[i]))[:15]
    regions = Counter()
    for c in conns:
        regions[c["region"]] += int(c["syn_count"])

    summary = {
        "id": species_id,
        "browserSimulation": browser_ok,
        "counts": {"neurons": len(neurons), "chemicalPairs": len(chem), "gapPairs": len(gap),
                   "synapses": sum(chem.values()) + sum(gap.values()),
                   "cellTypes": len(types)},
        "classCounts": [{"cls": c, "n": cls_of.count(c)} for c in order],
        "ntCounts": [{"nt": k or "unknown", "n": v}
                     for k, v in Counter(n["nt_type"] for n in neurons).most_common()],
        "flow": {"classes": order,
                 "matrix": [[flow[(a, b)] for b in order] for a in order]},
        "hubs": [{"id": neurons[i]["neuron_id"], "type": neurons[i]["cell_type"],
                  "cls": cls_of[i], "in_syn": syn_in[i], "out_syn": syn_out[i]} for i in hubs],
        "types": type_rows,
        "regions": [{"region": r, "syn": s} for r, s in regions.most_common(20)
                    if r != "all"],
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, separators=(",", ":")))
    size = (out_dir / "graph.json").stat().st_size / 1e6 if browser_ok else 0
    print(f"{species_id}: graph {size:.1f} MB, {len(types)} cell types")
    return meta


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    library = []
    for sid in list_species():
        meta_path = ROOT / "species" / sid / "species.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        try:
            meta = build(sid)
            meta["available"] = True
        except FileNotFoundError:
            meta["available"] = False
            print(f"{sid}: no data yet, listed only")
        library.append(meta)
    library += [{**p, "available": False} for p in PLANNED]
    (OUT / "library.json").write_text(json.dumps(library, indent=1, ensure_ascii=False))
    print(f"library.json: {len(library)} entries")


if __name__ == "__main__":
    main()
