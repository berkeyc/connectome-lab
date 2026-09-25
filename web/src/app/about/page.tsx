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
          Worm gap junctions add a weak electrical coupling. In the experiments, nothing in the circuit is trained: the
          wiring, synapse counts and signs are exactly as measured.
        </p>

        <h2>Real circuits cut from FlyWire</h2>
        <p>
          The whole FlyWire brain (v783, about 139,000 neurons and 54 million synapses) runs on the local runner. For the
          browser we cut circuits out of it: all neurons of chosen input and output types, plus every neuron on strong one or
          two step paths between them, with every synapse among the selected neurons kept. The escape circuit has 1,067
          neurons, the visuomotor circuit 1,325. Neurons outside a circuit are missing, and each circuit page says so.
        </p>

        <h2>Training</h2>
        <p>
          In the <Link href="/train">training lab</Link> the circuit stays fixed and only a linear readout learns: a few
          dozen numbers that turn the firing rates of chosen output neurons into movement. The optimiser is the cross entropy
          method, the recipe of Fly Dino and similar demos. Every generation is scored on episodes it trains on and on held
          out episodes it never sees, and the same training can be run on rewired, random and silenced circuits. A trained
          readout can often exploit any network, so a learning curve on its own proves little; the comparison with the
          controls is the result. Training uses a 0.25 ms step instead of 0.1 ms, which changes firing rates in these
          circuits by about 2 percent.
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
          <li>The FlyWire circuits lack the rest of the brain. The local runner removes that limit at the cost of speed.</li>
          <li>Transmitter identities in FlyWire are predicted from images; glutamate is treated as inhibitory, as in the published model.</li>
          <li>In this spiking model some worm head circuits (RIA and the head motor neurons) lock into persistent firing after a strong input, which real graded worm neurons do not do.</li>
          <li>The synthetic teaching fly has a textbook circuit layout and invented numbers. Only the parking demo still uses it, and it is labelled.</li>
        </ul>

        <h2>Seeing the circuit in 3D</h2>
        <p>
          The neural activity panel places every neuron of a FlyWire circuit at its measured position (a point on the neuron
          from the FlyWire annotations, in micrometres). Around it, a faint shell shows the envelope of the whole fly brain:
          a surface fitted to the positions of all 138,639 FlyWire neurons (smoothed on a 6 micrometre grid). It shows where
          neurons are; it is not an anatomical neuropil mesh.
        </p>
        <p>
          <strong>Real shapes.</strong> On request, the panel loads the real skeletons of up to 48 neurons of the circuit
          (descending neurons first) from the FlyWire v783 skeletons published by the Cambridge fly connectome group, the
          same source used by the fafbseg library. They are fetched by your browser and never stored by us.
        </p>
        <p>
          <strong>Simulated calcium imaging.</strong> Real experiments rarely see spikes directly; they watch a fluorescent
          calcium indicator. The calcium view turns the simulated spikes into what such a microscope would show: each spike
          raises the indicator along a rising and a decaying exponential, the signal saturates, and shot noise is added.
          Kinetics are approximate single spike values for GCaMP6s, GCaMP6f and jGCaMP8f (Chen et al. 2013, Zhang et al.
          2023). The idea follows the virtual calcium imaging in BrainGenix-NES; the implementation is our own.
        </p>
        <p>
          <strong>The fly.</strong> The fly in the scenes is the body model of{" "}
          <a href="https://github.com/TuragaLab/flybody">flybody</a> (Vaxenburg et al. 2025, Nature; Apache 2.0), rebuilt for
          the web by <code>pipeline/build_fly_model.py</code>: its 85 meshes placed on the model&apos;s joint tree, simplified
          to about 84,000 triangles (28,000 on phones), and dressed with macro textures of a compound eye, a wing, the
          thorax and the abdomen. Legs walk with a tripod gait, the wings fold flat at rest and beat in flight; the pose is
          animation for the eye, not a physics simulation of the body.
        </p>
        <p>
          <strong>The looming arena.</strong> The escape experiment is drawn the way it is done in the lab: a fly inside a
          curved LED display, where the threat is a dark disc that expands with angular size 2·atan(r/d), the stimulus
          that drives LPLC2 and the Giant Fiber (von Reyn et al. 2014; Klapoetke et al. 2017). The glossy grid floor
          mirrors the scene. On slow or software graphics the reflection and the finer materials switch off; add{" "}
          <code>?quality=high</code> or <code>?quality=low</code> to a page to choose.
        </p>

        <h2 id="nes">Running a circuit in BrainGenix-NES</h2>
        <p>
          <a href="https://github.com/carboncopies/BrainGenix-NES">BrainGenix-NES</a>, from the Carboncopies Foundation,
          simulates neurons with geometry and renders virtual electron microscopy and calcium imaging.{" "}
          <code>local/nes_bridge.py</code> builds any FlyWire circuit of the library inside a running NES: a soma at each
          neuron&apos;s position, a ball and stick neuron, one receptor per connection (strongest first, signed by
          transmitter), spontaneous input to chosen cell types, then it runs, records and saves the result. It is our own
          client, written from NES&apos;s published JSON protocol, so no AGPL code enters this MIT project. It has been
          checked against a mock server but not yet against a live NES; field names may need updating as their API evolves.
        </p>

        <h2>Who else works on this, and where we fit</h2>
        <p>
          We looked for people and institutions building a library like this one. Nobody offers exactly this combination, but
          several projects cover parts of it, and we build on or point to them:
        </p>
        <ul>
          <li>
            <a href="https://www.opensourcebrain.org/">Open Source Brain</a> and <a href="https://neuroml.org/">NeuroML</a>:
            the closest existing library of runnable neuroscience models, aimed at modellers. Exporting our circuits to
            NeuroML is on the roadmap.
          </li>
          <li>
            <a href="https://openworm.org/">OpenWorm</a>: open worm connectome data and simulation. Our worm data comes from
            their ConnectomeToolbox.
          </li>
          <li>
            <a href="https://flywire.ai/">FlyWire</a> and <a href="https://codex.flywire.ai/">Codex</a>, and Janelia&apos;s{" "}
            <a href="https://male-cns.janelia.org/">MaleCNS</a> and neuPrint: the fly datasets and their explorers.
          </li>
          <li>
            <a href="https://github.com/philshiu/Drosophila_brain_model">Shiu et al.</a>: the whole brain fly model we follow.{" "}
            <a href="https://github.com/NeLy-EPFL/flygym">NeuroMechFly and FlyGym</a> and{" "}
            <a href="https://github.com/TuragaLab/flybody">flybody</a>: simulated fly bodies.
          </li>
          <li>
            <a href="https://eon.systems/">Eon Systems</a>: a company emulating the whole fly brain in a simulated body.
          </li>
          <li>
            The 2026 wave of demos (Fly Dino, Swat, the Minecraft and Beat Saber flies and dozens more), collected in{" "}
            <a href="https://github.com/cobanov/awesome-fly">awesome-fly</a> and credited on our{" "}
            <Link href="/community">community page</Link>.
          </li>
        </ul>
        <p>
          Our niche is the one constraint we fix for every experiment: <strong>a result is only shown next to its controls</strong>.
          Everything else can change (species, task, readout), but no behaviour appears on this site without the rewired,
          random or silenced version beside it. That makes the library useful for teaching and for quick hypothesis checks,
          and keeps it honest about what the popular demos can and cannot show.
        </p>

        <h2>Run it yourself</h2>
        <pre>{`git clone https://github.com/berkeyc/connectome-lab.git
cd connectome-lab
pip install -r requirements.txt
python pipeline/build_web_bundle.py
cd web && npm install && npm run dev`}</pre>
        <p>
          The repository also contains the SQL layer, the importers, the local runner and a guide to adding a new species.
          Start from the <Link href="/train">training lab</Link> or the <Link href="/lab/c-elegans">worm lab</Link> if you just
          want to experiment.
        </p>
      </div>
    </div>
  );
}
