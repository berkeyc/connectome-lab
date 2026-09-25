"""Outline of the whole fly brain for the 3D views, fitted to real data.

    python pipeline/make_brain_surface.py

Takes the positions of all 138,639 FlyWire v783 neurons (data/species/fruit-fly-flywire,
written by import_flywire_v783.py), bins them on a 6 um grid, smooths the density and
extracts an iso-surface with marching cubes. The result is an envelope of where
neurons are, not an anatomical neuropil mesh. Output (about 200 kB):
    web/public/data/species/fruit-fly-flywire/surface.json  {"v": [x,y,z,...] um, "f": [a,b,c,...]}
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes

from common import LARGE_DIR, ROOT

GRID_UM = 6.0


def main():
    nr = pd.read_csv(LARGE_DIR / "fruit-fly-flywire" / "neurons.csv", usecols=["x", "y", "z"]).dropna()
    pts = nr[["x", "y", "z"]].to_numpy(float)
    lo = pts.min(0) - 4 * GRID_UM
    idx = np.floor((pts - lo) / GRID_UM).astype(int)
    shape = idx.max(0) + 5
    vol = np.zeros(shape, np.float32)
    np.add.at(vol, tuple(idx.T), 1.0)
    vol = gaussian_filter(vol, sigma=2.2)
    level = np.percentile(vol[vol > 0], 35)
    verts, faces, _, _ = marching_cubes(vol, level=level, step_size=3)
    verts = verts * GRID_UM + lo
    out = {"v": np.round(verts).astype(int).ravel().tolist(), "f": faces.astype(int).ravel().tolist(),
           "note": "Envelope of FlyWire v783 neuron positions (6 um grid, smoothed); not a neuropil mesh."}
    dst = ROOT / "web" / "public" / "data" / "species" / "fruit-fly-flywire" / "surface.json"
    dst.write_text(json.dumps(out, separators=(",", ":")))
    print(f"{len(verts):,} vertices, {len(faces):,} triangles, {dst.stat().st_size / 1e3:.0f} kB -> {dst}")


if __name__ == "__main__":
    main()
