"""Run a Connectome Lab circuit in BrainGenix-NES (experimental).

BrainGenix-NES is the Carboncopies Foundation's neuron emulation system
(https://github.com/carboncopies/BrainGenix-NES, AGPL-3.0). It simulates
neurons with geometry and can render virtual calcium imaging and electron
microscopy of the result. This script is our own small client, written from
NES's published JSON protocol (Docs/API.md): it does not include or import any
BrainGenix code, so Connectome Lab stays MIT licensed.

What it does
    1. loads a circuit from the library (with FlyWire positions, in micrometres),
    2. builds it in NES: a sphere soma at each neuron's position, a short axon,
       a ball and stick neuron, and one receptor per connection (the strongest
       connections first; excitatory or inhibitory by transmitter),
    3. gives the input neurons spontaneous activity, runs, records,
    4. writes the recording to a JSON file and prints spikes per cell type.

    # start the BrainGenix API and NES first (see their README), then
    python local/nes_bridge.py fly-escape-circuit --inputs LC4 LPLC2 --ms 500
    python local/nes_bridge.py fly-escape-circuit --host api.braingenix.org --port 443 --https --token $NES_TOKEN

Status: written against NES's documented API (route names and fields as of
September 2026) and not yet run against a live NES server. Expect to adjust
field names if their API changes; the NES API reports a version you can check.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import requests
except ImportError:  # pragma: no cover
    sys.exit("pip install requests")

ROOT = Path(__file__).resolve().parent.parent
BATCH = 400


class NES:
    """Minimal client for the batched JSON protocol: POST /NES?AuthKey=..., a list of {ReqID, <Route>: {...}}."""

    def __init__(self, host: str, port: int, https: bool, token: str):
        self.base = f"{'https' if https else 'http'}://{host}:{port}"
        self.token = token
        self.req = 0

    def call(self, queries: list[tuple[str, dict]]) -> list[dict]:
        out: list[dict] = []
        for k in range(0, len(queries), BATCH):
            chunk = []
            for route, params in queries[k:k + BATCH]:
                self.req += 1
                chunk.append({"ReqID": self.req, route: params})
            r = requests.post(f"{self.base}/NES", params={"AuthKey": self.token}, json=chunk, timeout=120)
            r.raise_for_status()
            resp = r.json()
            if not isinstance(resp, list) or len(resp) != len(chunk):
                raise RuntimeError(f"Unexpected NES response: {str(resp)[:300]}")
            for q, a in zip(chunk, resp):
                if a.get("StatusCode", 0) != 0:
                    route = next(key for key in q if key != "ReqID")
                    raise RuntimeError(f"NES rejected {route} (status {a.get('StatusCode')}): {a}")
            out.extend(resp)
        return out

    def one(self, route: str, params: dict) -> dict:
        return self.call([(route, params)])[0]


def load(species: str):
    base = ROOT / "species" / species
    if not (base / "neurons.csv").exists():
        base = ROOT / "data" / "species" / species
    meta = json.loads((ROOT / "species" / species / "species.json").read_text())
    nr = pd.read_csv(base / "neurons.csv", dtype={"neuron_id": str}, keep_default_na=False)
    cn = pd.read_csv(base / "connections.csv", dtype={"pre_id": str, "post_id": str}, keep_default_na=False)
    if not {"x", "y", "z"} <= set(nr.columns) or (nr["x"] == "").any():
        sys.exit(f"{species} has no neuron positions; NES needs them. Use a FlyWire circuit.")
    return meta, nr, cn


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("species", help="a library circuit with positions, e.g. fly-escape-circuit")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--https", action="store_true")
    ap.add_argument("--token", default=os.environ.get("NES_TOKEN", ""), help="AuthKey (or set NES_TOKEN)")
    ap.add_argument("--max-connections", type=int, default=20000, help="strongest connections to build")
    ap.add_argument("--inputs", nargs="*", default=[], help="cell types that get spontaneous activity")
    ap.add_argument("--rate", type=float, default=100.0, help="input rate in Hz")
    ap.add_argument("--ms", type=float, default=500.0, help="simulated time")
    ap.add_argument("--out", default="nes_recording.json")
    args = ap.parse_args()

    meta, nr, cn = load(args.species)
    sim = meta["sim"]
    sign = meta.get("sign", {})
    nt = dict(zip(nr["neuron_id"], nr["nt_type"]))
    pos = {r.neuron_id: (float(r.x), float(r.y), float(r.z)) for r in nr.itertuples()}
    chem = cn[cn["syn_type"] == "chemical"].copy()
    chem["syn_count"] = chem["syn_count"].astype(int)
    chem = chem.sort_values("syn_count", ascending=False).head(args.max_connections)
    print(f"{args.species}: {len(nr):,} neurons, building {len(chem):,} of {len(cn):,} connections in NES at {args.host}:{args.port}")

    nes = NES(args.host, args.port, args.https, args.token)
    sid = nes.one("Simulation/Create", {"Name": f"connectome-lab {args.species}"})["SimulationID"]
    ids = list(nr["neuron_id"])

    # geometry: soma spheres at the FlyWire positions, short axon cylinders
    soma = nes.call([("Simulation/Geometry/Sphere/Create", {
        "SimulationID": sid, "Radius_um": 2.0, "CenterPosX_um": pos[i][0], "CenterPosY_um": pos[i][1],
        "CenterPosZ_um": pos[i][2], "Name": f"soma {i}"}) for i in ids])
    axon = nes.call([("Simulation/Geometry/Cylinder/Create", {
        "SimulationID": sid, "Point1Radius_um": 0.5, "Point1PosX_um": pos[i][0], "Point1PosY_um": pos[i][1],
        "Point1PosZ_um": pos[i][2], "Point2Radius_um": 0.3, "Point2PosX_um": pos[i][0] + 6, "Point2PosY_um": pos[i][1],
        "Point2PosZ_um": pos[i][2], "Name": f"axon {i}"}) for i in ids])

    comp = dict(SimulationID=sid, MembranePotential_mV=sim["v_rest"], SpikeThreshold_mV=sim["v_th"],
                DecayTime_ms=sim["tau_m_ms"], RestingPotential_mV=sim["v_rest"], AfterHyperpolarizationAmplitude_mV=-10.0)
    soma_c = nes.call([("Simulation/Compartments/BS/Create", {**comp, "ShapeID": s["ShapeID"], "Name": f"soma {i}"})
                       for i, s in zip(ids, soma)])
    axon_c = nes.call([("Simulation/Compartments/BS/Create", {**comp, "ShapeID": a["ShapeID"], "Name": f"axon {i}"})
                       for i, a in zip(ids, axon)])
    neurons = nes.call([("Simulation/Neuron/BS/Create", {
        "SimulationID": sid, "SomaID": s["CompartmentID"], "AxonID": a["CompartmentID"],
        "MembranePotential_mV": sim["v_rest"], "RestingPotential_mV": sim["v_rest"], "SpikeThreshold_mV": sim["v_th"],
        "DecayTime_ms": sim["tau_m_ms"], "AfterHyperpolarizationAmplitude_mV": -10.0,
        "PostsynapticPotentialRiseTime_ms": 0.5, "PostsynapticPotentialDecayTime_ms": sim["tau_syn_ms"],
        "PostsynapticPotentialAmplitude_nA": 0.1, "Name": i}) for i, s, a in zip(ids, soma_c, axon_c)])
    soma_of = {i: s["CompartmentID"] for i, s in zip(ids, soma_c)}
    axon_of = {i: a["CompartmentID"] for i, a in zip(ids, axon_c)}
    neuron_of = {i: n["NeuronID"] for i, n in zip(ids, neurons)}

    # receptors: conductance proportional to synapse count, signed by the sender's transmitter
    nes.call([("Simulation/Receptor/Create", {
        "SimulationID": sid, "SourceCompartmentID": axon_of[r.pre_id], "DestinationCompartmentID": soma_of[r.post_id],
        "Conductance_nS": float(np.clip(r.syn_count * 0.5, 0.5, 60.0)) * (1 if sign.get(nt[r.pre_id], 0) >= 0 else -1),
        "TimeConstantRise_ms": 0.5, "TimeConstantDecay_ms": sim["tau_syn_ms"],
        "ReceptorPosX_um": pos[r.post_id][0], "ReceptorPosY_um": pos[r.post_id][1], "ReceptorPosZ_um": pos[r.post_id][2],
        "Name": f"{r.pre_id}>{r.post_id}"}) for r in chem.itertuples() if sign.get(nt[r.pre_id], 0) != 0])

    inputs = [neuron_of[i] for i, t in zip(nr["neuron_id"], nr["cell_type"]) if t in set(args.inputs)]
    if inputs:
        mean = 1000.0 / args.rate
        nes.one("Simulation/SetSpontaneousActivity", {"SimulationID": sid, "SpikeIntervalMean_ms": mean,
                                                      "SpikeIntervalStDev_ms": mean * 0.3, "NeuronIDs": inputs})
    nes.one("Simulation/RecordAll", {"SimulationID": sid, "MaxRecordTime_ms": args.ms})
    t0 = time.time()
    nes.one("Simulation/RunFor", {"SimulationID": sid, "Runtime_ms": args.ms})
    while nes.one("Simulation/GetStatus", {"SimulationID": sid}).get("IsSimulating"):
        time.sleep(1)
    rec = nes.one("Simulation/GetRecording", {"SimulationID": sid}).get("Recording")
    Path(args.out).write_text(json.dumps({"species": args.species, "neuron_ids": neuron_of, "recording": rec}))
    print(f"ran {args.ms:.0f} ms in {time.time() - t0:.1f} s, recording written to {args.out}")

    # spikes per cell type, when the recording lists spike times per neuron
    by_id = {v: k for k, v in neuron_of.items()}
    ctype = dict(zip(nr["neuron_id"], nr["cell_type"]))
    counts: Counter = Counter()
    spikes = (rec or {}).get("neuron_t_sp") if isinstance(rec, dict) else None
    if isinstance(spikes, dict):
        for nid, times in spikes.items():
            counts[ctype.get(by_id.get(int(nid), ""), "?")] += len(times)
        for t, c in counts.most_common(10):
            print(f"  {t:12s} {c:6d} spikes")


if __name__ == "__main__":
    main()
