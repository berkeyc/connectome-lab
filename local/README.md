# Local runner

Some experiments need more than a browser tab can give: the complete FlyWire fly brain (about 140,000 neurons and millions of connections), or games such as Minecraft that need their own client. The local runner simulates the brain on your computer and streams it to the Connectome Lab website, so you keep the same live view, brain signals and controls.

## Start

```bash
pip install -r local/requirements.txt
python local/runner.py
```

It listens on `ws://localhost:8765`, only on your own machine. Open any experiment on the website, choose **Local runner** in the player controls and press **Restart**. Your browser may ask for permission to connect to a local device; allow it.

## The full FlyWire brain

```bash
# 1. download neurons, classification and connections from https://codex.flywire.ai into data/raw/flywire/
python pipeline/import_flywire.py --min-syn 5
# 2. start the runner and open "The real fly brain drives a car"
python local/runner.py --dt 0.25
```

## Options

| Option | Use |
|---|---|
| `--dt 0.25` | Larger time step: faster, slightly less precise. |
| `--alias GF=DNp01` | The site asks for a cell type under a different name than your dataset uses. Repeatable. |
| `--use fruit-fly-synthetic` | Serve this species for every request, whatever the page asks for. Handy for testing. |
| `--port 9000` | Different port (the website expects 8765). |

## Protocol

Plain JSON over WebSocket, so other tools (a Minecraft bridge, a robot, a notebook) can use the same brain:

```text
→ {"type":"init","species":"fruit-fly-flywire","brain":"real","seed":1,"lesion":[],"channels":[{"id":"gf","targets":[{"cell_type":"DNp01"}]}]}
← {"type":"ready","neurons":139255,"classes":[...],"cls":[...],"missing":[]}
→ {"type":"tick","id":1,"ms":20,"inputs":[{"targets":[{"cell_type":"LC4","side":"right"}],"hz":150}]}
← {"type":"tick","id":1,"rates":{"gf":42.0},"spikes":{"t":[...],"i":[...]},"active":311}
```
