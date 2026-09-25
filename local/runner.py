"""Connectome Lab local runner.

Simulates connectomes that are too large for a browser tab (for example the full
FlyWire fly brain) on your own computer, and streams the results to the
Connectome Lab website over a local WebSocket.

    pip install -r local/requirements.txt
    python local/runner.py                      # ws://localhost:8765
    python local/runner.py --dt 0.25            # faster, coarser time step
    python local/runner.py --alias GF=DNp01     # rename a cell type the site asks for
    python local/runner.py --use fruit-fly-synthetic   # serve this species whatever the site asks

Then open an experiment on the website, choose "Local runner" and press Restart.

The model is the same leaky integrate and fire network as the website
(Shiu et al. 2024): chemical synapses signed by the sender's transmitter,
optional gap junction coupling, Poisson input to stimulated neurons.
The server only listens on 127.0.0.1, so nothing outside your computer can reach it,
and it only accepts pages from the Connectome Lab site and from localhost
(add your own deployment with --allow-origin https://your.site).
"""

from __future__ import annotations

import argparse
import asyncio
import ipaddress
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import websockets
except ImportError:  # pragma: no cover
    sys.exit("Missing dependency: pip install -r local/requirements.txt")

ROOT = Path(__file__).resolve().parent.parent
SIDE_CODE = {"left": 0, "right": 1}
SPECIES_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
DEFAULT_ORIGINS = [
    "https://connectome-lab-gamma.vercel.app",
    "http://localhost:3000", "http://127.0.0.1:3000",
]
MAX_MESSAGE = 1 << 20  # 1 MB per message is plenty for inputs and channel lists
MAX_TARGETS = 256


# --------------------------------------------------------------------------
# Loading a species from the library format
# --------------------------------------------------------------------------

class Species:
    def __init__(self, species_id: str):
        if not SPECIES_ID.match(species_id):
            raise ValueError("Invalid species id")
        meta_path = ROOT / "species" / species_id / "species.json"
        if not meta_path.exists():
            raise FileNotFoundError(f"Unknown species '{species_id}' (no {meta_path.relative_to(ROOT)})")
        self.meta = json.loads(meta_path.read_text(encoding="utf-8"))
        base = ROOT / "species" / species_id
        if not (base / "neurons.csv").exists():
            base = ROOT / "data" / "species" / species_id
        if not (base / "neurons.csv").exists():
            raise FileNotFoundError(
                f"No data for '{species_id}'. Import it first, for FlyWire: python pipeline/import_flywire_v783.py")
        t0 = time.time()
        neurons = pd.read_csv(base / "neurons.csv", dtype={"neuron_id": str}, keep_default_na=False)
        # numeric ids (FlyWire) are read as integers: far less memory for 15 million rows
        numeric = bool(neurons["neuron_id"].str.fullmatch(r"\d+").all())
        id_type = "int64" if numeric else str
        if numeric:
            neurons["neuron_id"] = neurons["neuron_id"].astype("int64")
        conns = pd.read_csv(base / "connections.csv", dtype={"pre_id": id_type, "post_id": id_type, "syn_type": "category"},
                            usecols=["pre_id", "post_id", "syn_type", "syn_count"], keep_default_na=False)
        self.n = len(neurons)
        index = pd.Series(np.arange(self.n), index=neurons["neuron_id"])
        self.cell_type = neurons["cell_type"].astype(str).to_numpy()
        self.side = neurons["side"].map(lambda s: SIDE_CODE.get(s, 2)).to_numpy()
        self.classes = sorted(set(neurons["super_class"].replace("", "other")))
        cls_index = {c: i for i, c in enumerate(self.classes)}
        self.cls = neurons["super_class"].replace("", "other").map(cls_index).to_numpy()
        sign_map = self.meta.get("sign", {})
        self.sign = neurons["nt_type"].map(lambda t: sign_map.get(t, 0)).to_numpy(dtype=np.float32)

        pre = index[conns["pre_id"]].to_numpy()
        post = index[conns["post_id"]].to_numpy()
        w = conns["syn_count"].to_numpy(dtype=np.float32)
        chem = conns["syn_type"].to_numpy() == "chemical"
        self.chem = self._aggregate(pre[chem], post[chem], w[chem])
        self.gap = self._aggregate(pre[~chem], post[~chem], w[~chem])
        print(f"  loaded {species_id}: {self.n:,} neurons, {len(self.chem[0]):,} chemical and "
              f"{len(self.gap[0]):,} electrical pairs in {time.time() - t0:.1f}s")

    def _aggregate(self, pre, post, w):
        if len(pre) == 0:
            return (np.zeros(0, np.int64), np.zeros(0, np.int64), np.zeros(0, np.float32))
        key = pre.astype(np.int64) * self.n + post
        uniq, inv = np.unique(key, return_inverse=True)
        sums = np.bincount(inv, weights=w).astype(np.float32)
        return (uniq // self.n, uniq % self.n, sums)

    def select(self, targets, alias):
        mask = np.zeros(self.n, bool)
        missing = []
        for t in targets:
            name = alias.get(t["cell_type"], t["cell_type"])
            m = self.cell_type == name
            if not m.any():
                missing.append(t["cell_type"])
                continue
            if t.get("side") in SIDE_CODE:
                m &= self.side == SIDE_CODE[t["side"]]
            mask |= m
        return np.flatnonzero(mask), missing


# --------------------------------------------------------------------------
# The brain
# --------------------------------------------------------------------------

def rewire(sp: Species, variant: str, rng: np.random.Generator):
    pre, post, w = (a.copy() for a in sp.chem)
    sign = sp.sign.copy()
    m = len(pre)
    if variant == "degree":
        # batched double edge swaps: keeps every neuron's in and out degree
        for _ in range(5):
            a = rng.permutation(m)
            b = np.roll(a, 1)
            ok = (pre[a] != post[b]) & (pre[b] != post[a])
            post[a[ok]], post[b[ok]] = post[b[ok]].copy(), post[a[ok]].copy()
    elif variant == "random":
        pre = rng.integers(0, sp.n, m)
        post = rng.integers(0, sp.n, m)
        keep = pre != post
        pre, post, w = pre[keep], post[keep], rng.permutation(w)[keep]
    elif variant == "signs":
        sign = rng.permutation(sign)
    return pre, post, w, sign


class Brain:
    def __init__(self, sp: Species, sim: dict, variant: str, seed: int, lesion_idx: np.ndarray, dt: float | None):
        self.sp = sp
        self.p = dict(sim)
        if dt:
            self.p["dt_ms"] = dt
        self.rng = np.random.default_rng(seed)
        pre, post, w, sign = rewire(sp, variant, self.rng)
        weight = w * sign[pre] * self.p["w_syn_mv"]
        order = np.argsort(pre, kind="stable")
        self.post = post[order]
        self.weight = weight[order].astype(np.float32)
        self.start = np.zeros(sp.n + 1, np.int64)
        np.add.at(self.start, pre[order] + 1, 1)
        self.start = np.cumsum(self.start)
        self.gap_pre, self.gap_post, self.gap_w = sp.gap
        n = sp.n
        self.v = np.full(n, self.p["v_rest"], np.float32)
        self.g = np.zeros(n, np.float32)
        self.refr = np.zeros(n, np.int32)
        self.delay = max(1, round(self.p["delay_ms"] / self.p["dt_ms"]))
        self.ring = np.zeros((self.delay + 1, n), np.float32)
        self.k = 0
        self.silenced = np.zeros(n, bool)
        self.silenced[lesion_idx] = True
        self.input_hz = np.zeros(n, np.float32)

    def step(self, ms: float, cap: int = 3000):
        p = self.p
        dt = p["dt_ms"]
        steps = max(1, round(ms / dt))
        decay = np.float32(np.exp(-dt / p["tau_syn_ms"]))
        leak = np.float32(dt / p["tau_m_ms"])
        ref_steps = round(p["t_ref_ms"] / dt)
        driven = np.flatnonzero((self.input_hz > 0) & ~self.silenced)
        prob = self.input_hz[driven] * dt * 1e-3
        counts = np.zeros(self.sp.n, np.int32)
        ev_t, ev_i = [], []
        L = self.delay + 1
        has_gap = p.get("g_gap", 0) > 0 and len(self.gap_pre) > 0
        for s in range(steps):
            arriving = self.ring[self.k % L]
            self.g = self.g * decay + arriving
            arriving[:] = 0
            if len(driven):
                hit = driven[self.rng.random(len(driven)) < prob]
                self.g[hit] += p["input_w_mv"]
            dv = leak * (p["v_rest"] - self.v + self.g)
            if has_gap:
                cur = np.zeros(self.sp.n, np.float32)
                np.add.at(cur, self.gap_post, p["g_gap"] * self.gap_w * (self.v[self.gap_pre] - self.v[self.gap_post]))
                dv += dt * cur
            active = (self.refr == 0) & ~self.silenced
            self.v[active] += dv[active]
            self.refr[self.refr > 0] -= 1
            self.v[self.silenced] = p["v_rest"]
            spk = np.flatnonzero(self.v >= p["v_th"])
            if len(spk):
                self.v[spk] = p["v_reset"]
                self.refr[spk] = ref_steps
                counts[spk] += 1
                if len(ev_t) < cap:
                    take = spk[: cap - len(ev_t)]
                    ev_t.extend([s * dt] * len(take))
                    ev_i.extend(take.tolist())
                lo, hi = self.start[spk], self.start[spk + 1]
                lens = hi - lo
                if lens.sum():
                    idx = np.repeat(lo - np.cumsum(np.r_[0, lens[:-1]]), lens) + np.arange(lens.sum())
                    future = self.ring[(self.k + self.delay) % L]
                    np.add.at(future, self.post[idx], self.weight[idx])
            self.k += 1
        return counts, ev_t, ev_i


# --------------------------------------------------------------------------
# WebSocket server
# --------------------------------------------------------------------------

class Server:
    def __init__(self, args):
        self.args = args
        self.cache: dict[str, Species] = {}
        self.alias = dict(a.split("=", 1) for a in args.alias)

    def species(self, sid: str) -> Species:
        sid = self.args.use or sid
        if sid not in self.cache:
            self.cache[sid] = Species(sid)
        return self.cache[sid]

    async def handle(self, ws):
        brain = None
        channels: dict[str, np.ndarray] = {}
        sp = None
        async for raw in ws:
            try:
                msg = json.loads(raw)
                if not isinstance(msg, dict):
                    raise ValueError("Bad message")
                if msg["type"] == "init":
                    if len(msg.get("channels", [])) > 64 or len(msg.get("lesion", [])) > MAX_TARGETS:
                        raise ValueError("Too many channels or lesions")
                    t0 = time.time()
                    sp = self.species(msg["species"])
                    missing = set()
                    lesion, miss = sp.select(msg.get("lesion", []), self.alias)
                    missing.update(miss)
                    brain = Brain(sp, sp.meta["sim"], msg.get("brain", "real"), int(msg.get("seed", 1)), lesion, self.args.dt)
                    channels = {}
                    for ch in msg.get("channels", []):
                        idx, miss = sp.select(ch["targets"], self.alias)
                        channels[ch["id"]] = idx
                        missing.update(miss)
                    print(f"  session: {sp.meta['id']} ({msg.get('brain', 'real')} brain), ready in {time.time() - t0:.1f}s")
                    await ws.send(json.dumps({
                        "type": "ready", "neurons": sp.n, "classes": sp.classes, "cls": sp.cls.tolist(),
                        "missing": sorted(missing), "species": sp.meta["id"],
                    }))
                elif msg["type"] == "tick" and brain is not None:
                    brain.input_hz[:] = 0
                    inputs = msg.get("inputs", [])
                    if len(inputs) > MAX_TARGETS:
                        raise ValueError("Too many inputs")
                    for inp in inputs:
                        idx, _ = sp.select(inp["targets"][:MAX_TARGETS], self.alias)
                        brain.input_hz[idx] = min(max(float(inp["hz"]), 0.0), 1000.0)
                    ms = min(max(float(msg.get("ms", 20)), 1.0), 200.0)
                    t0 = time.time()
                    counts, ev_t, ev_i = brain.step(ms)
                    rates = {cid: (float(counts[idx].mean()) * 1000 / ms if len(idx) else 0.0) for cid, idx in channels.items()}
                    await ws.send(json.dumps({
                        "type": "tick", "id": msg["id"], "rates": rates,
                        "spikes": {"t": ev_t, "i": ev_i}, "active": int((counts > 0).sum()),
                        "computeMs": (time.time() - t0) * 1000,
                    }))
            except Exception as err:  # report problems to the page instead of dying
                await ws.send(json.dumps({"type": "error", "message": f"{type(err).__name__}: {err}"}))


async def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--dt", type=float, help="simulation time step in ms (default: species setting, 0.1)")
    ap.add_argument("--alias", action="append", default=[], metavar="ASKED=ACTUAL",
                    help="map a cell type name the site asks for to the name in your dataset")
    ap.add_argument("--use", help="serve this species id for every request")
    ap.add_argument("--allow-origin", action="append", default=[], metavar="URL",
                    help="also accept pages from this origin, e.g. https://my-copy.example.org")
    args = ap.parse_args()
    try:
        loopback = ipaddress.ip_address(args.host).is_loopback
    except ValueError:
        loopback = args.host == "localhost"
    if not loopback:
        print(f"Warning: listening on {args.host} exposes the runner beyond this computer.")
    server = Server(args)
    # Browsers always send an Origin header; only our site and localhost may connect.
    # None admits non-browser clients on this machine (scripts, tests).
    origins = [*DEFAULT_ORIGINS, *args.allow_origin, None]
    async with websockets.serve(server.handle, args.host, args.port, max_size=MAX_MESSAGE, origins=origins):
        print(f"Connectome Lab local runner listening on ws://{args.host}:{args.port}")
        print("Open an experiment on the website, choose 'Local runner' and press Restart.")
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
