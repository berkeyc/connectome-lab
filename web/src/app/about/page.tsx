import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Method", description: "How Connectome Lab simulates mapped nervous systems, and what it cannot tell you." };

export default function About() {
  return (
    <div className="wrap" style={{ paddingTop: 48 }}>
      <div className="prose">
        <div className="eyebrow">Method</div>
        <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", marginTop: 10 }}>How the lab works</h1>
        <p className="lede" style={{ marginTop: 16 }}>
          A connectome is a wiring diagram: which neuron connects to which, and through how many synapses. Connectome
          Lab asks a simple question of each one. How much behaviour can the wiring produce on its own?
        </p>

        <h2>One format for every animal</h2>
        <p>
          Each species is stored as three files: <code>species.json</code> (metadata, transmitter signs, model settings,
          ready made experiments), <code>neurons.csv</code> and <code>connections.csv</code>. Importers turn published
          datasets into this format, and the same files feed a PostgreSQL database for analysis and the website for
          simulation. Adding an animal means writing one importer, not a new app.
        </p>

        <h2>The model</h2>
        <p>
          Every neuron is a leaky integrate and fire unit, following the whole brain fly model of Shiu and colleagues
          (Nature, 2024). A spike travels to every partner after 1.8 ms and nudges its membrane by a fixed amount times
          the number of synapses. Whether the nudge excites or inhibits depends only on the sender&apos;s transmitter
          (Dale&apos;s law). Stimulated neurons receive strong random input, which stands in for a sensory stimulus.
          Worm gap junctions add a weak electrical coupling. Nothing is trained: all behaviour comes from the map.
        </p>

        <h2>Readouts</h2>
        <p>
          Firing rates are summarised into behaviour readouts chosen from the literature, for example crawling direction
          in the worm (forward command neurons AVB and PVC against backward command neurons AVA, AVD and AVE) or take off
          in the fly (the Giant Fiber). They are proxies for behaviour, not behaviour itself.
        </p>

        <h2>Controls</h2>
        <p>A result only means something next to a baseline. The lab offers three control brains:</p>
        <ul>
          <li><strong>Same degrees.</strong> Repeated edge swaps keep every neuron&apos;s number of inputs and outputs but scramble partners.</li>
          <li><strong>Random wiring.</strong> Same number of connections and the same weights, placed at random.</li>
          <li><strong>Shuffled transmitters.</strong> The real map, but excitation and inhibition are handed out at random.</li>
        </ul>
        <p>
          When the real brain produces a response the controls do not, the behaviour depends on the specific wiring. When
          it does not, the model is missing something, which is just as informative.
        </p>

        <h2>Honest limits</h2>
        <ul>
          <li>Real neurons differ in size, receptors and dynamics. Here they are all the same simple unit.</li>
          <li>Neuromodulators, learning and body feedback are absent.</li>
          <li>Most worm neurons are graded rather than spiking, so the worm model is a strong simplification. It reproduces the nose touch reversal and the effect of removing AVA, and it does not reproduce the forward response to tail touch.</li>
          <li>The synthetic fly has realistic circuit layout and invented numbers. Use the FlyWire importer for real fly results.</li>
        </ul>

        <h2>Run it yourself</h2>
        <pre>{`git clone https://github.com/berkeyc/connectome-lab.git
cd connectome-lab
pip install -r requirements.txt
python pipeline/build_web_bundle.py
cd web && npm install && npm run dev`}</pre>
        <p>
          The repository also contains the SQL layer, the importers and a guide to adding a new species. Start from the{" "}
          <Link href="/lab/c-elegans">worm lab</Link> if you just want to experiment.
        </p>
      </div>
    </div>
  );
}
