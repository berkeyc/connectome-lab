"""Anatomy previews for the library: every neuron of a dataset at its measured
FlyWire position, seen from the front, coloured by class. Circuits are drawn
over the faint outline of the whole brain.

  python pipeline/make_anatomy_thumbs.py   (needs data/species/fruit-fly-flywire/neurons.csv)
Writes web/public/thumbs/species-<id>.webp
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "public" / "thumbs"
W, H = 640, 400
BG = np.array([14, 17, 19], float)
COLORS = {
    "sensory": (224, 164, 88), "optic": (217, 140, 95), "visual_projection": (224, 123, 79), "visual_centrifugal": (200, 120, 90),
    "central": (122, 167, 217), "interneuron": (122, 167, 217), "descending": (94, 203, 143), "ascending": (159, 209, 139),
    "motor": (94, 203, 143), "endocrine": (200, 160, 220), "other": (140, 150, 163),
}


def frame(xs, ys):
    x0, x1 = np.percentile(xs, [0.2, 99.8])
    y0, y1 = np.percentile(ys, [0.2, 99.8])
    s = min((W * 0.9) / (x1 - x0), (H * 0.86) / (y1 - y0))
    return lambda x, y: (((x - (x0 + x1) / 2) * s + W / 2).astype(int), ((y - (y0 + y1) / 2) * s + H / 2).astype(int))


def splat(img, px, py, col, gain):
    ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
    for c in range(3):
        np.add.at(img[..., c], (py[ok], px[ok]), col[ok, c] * gain)


def finish(img, name):
    glow = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
    base = np.asarray(glow, float) * 0.9 + np.clip(img, 0, 255) * 0.6
    out = np.clip(BG + base, 0, 255).astype(np.uint8)
    Image.fromarray(out).save(OUT / f"species-{name}.webp", quality=82)
    print("wrote", name)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    full = pd.read_csv(ROOT / "data" / "species" / "fruit-fly-flywire" / "neurons.csv", usecols=["super_class", "x", "y"]).dropna()
    to = frame(full.x.values, full.y.values)
    fx, fy = to(full.x.values, full.y.values)
    cols = np.array([COLORS.get(s, COLORS["other"]) for s in full.super_class], float)
    img = np.zeros((H, W, 3))
    splat(img, fx, fy, cols, 0.22)
    finish(img, "fruit-fly-flywire")
    for sid in ["fly-escape-circuit", "fly-visuomotor-circuit", "fly-gym-circuit"]:
        c = pd.read_csv(ROOT / "species" / sid / "neurons.csv", usecols=["super_class", "x", "y"]).dropna()
        img = np.zeros((H, W, 3))
        splat(img, fx, fy, np.full((len(fx), 3), 120.0), 0.05)  # the whole brain, faint
        px, py = to(c.x.values, c.y.values)
        cc = np.array([COLORS.get(s, COLORS["other"]) for s in c.super_class], float)
        for dx in (-2, -1, 0, 1, 2):
            for dy in (-2, -1, 0, 1, 2):
                r = abs(dx) + abs(dy)
                splat(img, px + dx, py + dy, cc, 1.6 if r == 0 else 0.7 if r == 1 else 0.25 if r == 2 else 0.0)
        finish(img, sid)


if __name__ == "__main__":
    main()
