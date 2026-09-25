"""Shared helpers for every species importer.

Every species ends up in the same neutral format:

    species/<species_id>/species.json     metadata, sign rules, simulation settings, presets
    species/<species_id>/neurons.csv      neuron_id, super_class, class, cell_type, side, nt_type, nt_score
    species/<species_id>/connections.csv  pre_id, post_id, region, syn_type, syn_count

Large datasets (the full FlyWire brain) are written to data/species/<species_id>/
instead, which is ignored by git.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPECIES_DIR = ROOT / "species"
LARGE_DIR = ROOT / "data" / "species"

NEURON_COLS = ["neuron_id", "super_class", "class", "cell_type", "side", "nt_type", "nt_score",
               "x", "y", "z"]  # x, y, z: a point on the neuron in micrometres, optional
CONN_COLS = ["pre_id", "post_id", "region", "syn_type", "syn_count"]

# Standard super classes. Species may use a subset; the web app colours by these.
SUPER_CLASSES = ["sensory", "optic", "visual_projection", "interneuron", "central",
                 "descending", "ascending", "motor", "other"]


def species_path(species_id: str, large: bool = False) -> Path:
    p = (LARGE_DIR if large else SPECIES_DIR) / species_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_rows(path: Path, cols: list[str], rows: list[dict]):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: ("" if r.get(c) is None else r.get(c)) for c in cols})


def write_species(species_id: str, meta: dict, neurons: list[dict], conns: list[dict],
                  large: bool = False):
    out = species_path(species_id, large)
    ids = {n["neuron_id"] for n in neurons}
    missing = {c["pre_id"] for c in conns} | {c["post_id"] for c in conns}
    missing -= ids
    if missing:
        raise ValueError(f"{len(missing)} connection endpoints are not in neurons, e.g. "
                         f"{sorted(missing)[:5]}")
    write_rows(out / "neurons.csv", NEURON_COLS, neurons)
    write_rows(out / "connections.csv", CONN_COLS, conns)
    meta = {**meta, "id": species_id,
            "stats": {"neurons": len(neurons), "connections": len(conns),
                      "synapses": int(sum(int(c["syn_count"]) for c in conns))}}
    # species.json always lives in the committed registry, even for large datasets
    reg = species_path(species_id)
    (reg / "species.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
                                      encoding="utf-8")
    print(f"{species_id}: {len(neurons):,} neurons, {len(conns):,} connections -> {out}")


def read_species(species_id: str):
    meta = json.loads((SPECIES_DIR / species_id / "species.json").read_text(encoding="utf-8"))
    base = SPECIES_DIR / species_id
    if not (base / "neurons.csv").exists():
        base = LARGE_DIR / species_id
    with open(base / "neurons.csv", encoding="utf-8") as f:
        neurons = list(csv.DictReader(f))
    with open(base / "connections.csv", encoding="utf-8") as f:
        conns = list(csv.DictReader(f))
    return meta, neurons, conns


def list_species() -> list[str]:
    return sorted(p.name for p in SPECIES_DIR.iterdir() if (p / "species.json").exists())
