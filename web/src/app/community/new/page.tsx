import type { Metadata } from "next";
import Link from "next/link";
import ExperimentBuilder from "@/components/ExperimentBuilder";

export const metadata: Metadata = {
  title: "Build an experiment",
  description: "Design your own training experiment on a real connectome: choose the circuit, the input neurons and the readout, then train and share it.",
};

export default function NewExperiment() {
  return (
    <div className="wrap">
      <header className="page-head compact">
        <div>
          <div className="eyebrow">
            <Link href="/community">Community</Link> · builder
          </div>
          <h1>Build an experiment</h1>
          <p className="lede">
            Choose a real circuit, decide which neurons the senses excite and which neurons the readout may use. Then train it
            against rewired controls and share the link.
          </p>
        </div>
      </header>
      <ExperimentBuilder />
    </div>
  );
}
