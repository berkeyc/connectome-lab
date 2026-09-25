# Local runner

Some experiments need more than a browser tab can give: the complete FlyWire fly brain (138,639 connected neurons and 15 million connections), or games such as Minecraft that need their own client. The local runner simulates the brain on your computer and streams it to the Connectome Lab website, so you keep the same live view, brain signals and controls.

## Start

```bash
pip install -r local/requirements.txt
python local/runner.py
```

It listens on `ws://localhost:8765`, only on your own machine, and only accepts pages from the Connectome Lab site and from `localhost:3000` (browsers send their origin; anything else is refused). Messages are capped at 1 MB, input rates at 1,000 Hz and ticks at 200 ms. Open any experiment on the website, choose **Local runner** in the player controls and press **Restart**. Your browser may ask for permission to connect to a local device; allow it.

## The full FlyWire brain

```bash
# 1. download the FlyWire v783 connectivity table and annotations (about 100 MB) and import them
python pipeline/import_flywire_v783.py
# 2. start the runner and open "The whole fly brain escapes a looming shadow"
python local/runner.py --dt 0.25
```

The whole brain loads in about 10 seconds and uses about 1 GB of memory. On a two core machine it runs roughly 12 times slower than real time at the default step; `--dt 0.25` is about 2.5 times faster.

## Options

| Option | Use |
|---|---|
| `--dt 0.25` | Larger time step: faster, slightly less precise. |
| `--alias GF=DNp01` | The site asks for a cell type under a different name than your dataset uses. Repeatable. |
| `--use fruit-fly-synthetic` | Serve this species for every request, whatever the page asks for. Handy for testing. |
| `--port 9000` | Different port (the website expects 8765). |
| `--allow-origin https://my-copy.example.org` | Also accept pages from your own deployment of the site. Repeatable. |

## Protocol

Plain JSON over WebSocket, so other tools (a Minecraft bridge, a robot, a notebook) can use the same brain:

```text
→ {"type":"init","species":"fruit-fly-flywire","brain":"real","seed":1,"lesion":[],"channels":[{"id":"gf","targets":[{"cell_type":"DNp01"}]}]}
← {"type":"ready","neurons":138639,"classes":[...],"cls":[...],"missing":[]}
→ {"type":"tick","id":1,"ms":20,"inputs":[{"targets":[{"cell_type":"LC4","side":"right"}],"hz":150}]}
← {"type":"tick","id":1,"rates":{"gf":42.0},"spikes":{"t":[...],"i":[...]},"active":311}
```
