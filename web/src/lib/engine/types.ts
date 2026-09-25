// Shared types for species bundles, experiments and results.

export type SimParams = {
  /** "lif": spiking neurons (flies). "rate": graded neurons (worms), activity 0..1 */
  model?: "lif" | "rate";
  duration_ms: number;
  dt_ms: number;
  v_rest: number;
  v_reset: number;
  v_th: number;
  tau_m_ms: number;
  t_ref_ms: number;
  tau_syn_ms: number;
  delay_ms: number;
  w_syn_mv: number; // membrane kick per chemical synapse
  g_gap: number; // coupling per gap junction contact
  input_rate_hz: number; // Poisson rate for stimulated neurons
  input_w_mv: number; // kick per Poisson input spike
  // rate model only
  tau_ms?: number;
  input_drive?: number; // constant drive for stimulated neurons
};

export type Target = { cell_type: string; side?: "left" | "right" | "center" };

export type ReadoutSpec = {
  id: string;
  label: string;
  description: string;
  positive: Target & { label: string; cell_types: string[] };
  negative?: Target & { label: string; cell_types: string[] };
};

export type Preset = {
  id: string;
  label: string;
  description: string;
  stimulate: Target[];
  lesion: Target[];
  expected: string;
};

export type SpeciesMeta = {
  id: string;
  common_name: string;
  latin_name: string;
  status: "real" | "synthetic" | "import" | "planned";
  summary: string;
  dataset: string;
  source_url: string;
  license: string;
  citations: string[];
  caveats: string[];
  sign: Record<string, number>;
  sim: SimParams;
  readouts: ReadoutSpec[];
  presets: Preset[];
  stats: { neurons: number; connections: number; synapses: number } | null;
};

/** Compact graph shipped to the browser. Arrays are aligned by neuron index. */
export type Graph = {
  id: string;
  neuronIds: string[];
  types: string[]; // distinct cell types
  classes: string[]; // distinct super classes
  nts: string[]; // distinct transmitter codes
  type: number[]; // per neuron index into types
  cls: number[]; // per neuron index into classes
  side: number[]; // 0 left, 1 right, 2 center
  /** neuron positions in micrometres, x y z per neuron (FlyWire circuits) */
  pos?: number[];
  nt: number[]; // per neuron index into nts
  chem: { pre: number[]; post: number[]; w: number[] };
  gap: { pre: number[]; post: number[]; w: number[] };
};

export type BrainVariant = "real" | "degree" | "random" | "signs";

export type ExperimentConfig = {
  stimulate: Target[];
  lesion: Target[];
  brain: BrainVariant;
  seed: number;
  durationMs?: number;
  inputRateHz?: number;
};

export type Readout = {
  id: string;
  label: string;
  value: number; // positive minus negative activity (Hz or % of max)
  positiveHz: number;
  negativeHz: number | null;
  positiveLabel: string;
  negativeLabel: string | null;
};

export type SimResult = {
  config: ExperimentConfig;
  durationMs: number;
  neurons: number;
  totalSpikes: number;
  activeNeurons: number;
  unit: "Hz" | "%";
  rateByNeuron: Float32Array;
  rateByType: { type: string; cls: string; hz: number; n: number }[];
  rateByClass: { cls: string; hz: number; n: number }[];
  readouts: Readout[];
  raster: { t: Float32Array; i: Int32Array }; // capped spike sample for plotting
  runtimeMs: number;
};
