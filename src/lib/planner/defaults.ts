import { CDEF, type Companion, type Gpu, type Model, type StackItem } from "@/lib/engine";
import { COMPANION_INDEX, COMPANIONS, GPU_INDEX, MODEL_INDEX, MODELS, GPUS } from "@/lib/catalog";

export const USERS_STEPS = [1, 2, 4, 8, 16, 25, 32, 50, 64, 100, 128, 150, 200, 256, 300, 400, 500, 750, 1000, 1500, 2000];
export const SEQ_STEPS = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576];
/** People read ≈ 5.5 tokens per second (1 token ≈ ¾ word). */
export const READ_TPS = 5.5;
export const GPU_COUNTS = [1, 2, 4, 8, 16] as const;

export type Mode = "inf" | "ft";

export interface OffloadState {
  on: boolean;
  by: "layers" | "pct";
  layers: number;
  pct: number;
  kv: boolean;
  target: "ram" | "nvme";
  exec: "cpu" | "pcie";
}

export interface PlannerState {
  mode: Mode;
  modelId: string;
  custom: Model | null;
  gpuId: string;
  customGpu: Gpu | null;
  wq: string;
  kvq: string;
  engine: string;
  hw: "single" | "cluster";
  n: number;
  autoN: boolean;
  nodes: number;
  perNode: number;
  tp: number;
  pp: number;
  net: string;
  users: number;
  batch: number;
  seq: number;
  out: number;
  prefix: number;
  offload: OffloadState;
  host: string;
  usable: number;
  eta: number | null;
  mfu: number | null;
  burst: number;
  chunk: number;
  graphs: boolean;
  comm: boolean;
  kvMode: "conservative" | "exact";
  swa: boolean;
  keep16: boolean;
  prec: "fp16" | "eight" | "four";
  other: number;
  ramEff: number;
  cpuTflops: number;
  nvme: number;
  price: number | null;
  kwh: number;
  util: number;
  powerLoad: number;
  hostOverhead: number;
  coresPerGpu: number;
  appCores: number;
  offCores: number;
  appRam: number;
  method: "full" | "lora" | "qlora";
  ftPrec: "mixed" | "pure" | "fp32";
  optim: string;
  loraR: number;
  loraTargets: "attn" | "all";
  ftBatch: number;
  ftSeq: number;
  gradAccum: number;
  zero: "none" | "zero1" | "zero2" | "zero3";
  samples: number;
  tokPerSample: number;
  epochs: number;
  ckpt: boolean;
  flash: boolean;
  fused: boolean;
  packing: boolean;
  dynPad: boolean;
  pure16: boolean;
  ftMfu: number | null;
  ftOffOn: boolean;
  ftOff: { optim: boolean; grads: boolean; weights: boolean; act: boolean };
  stack: StackItem[];
  qpm: number;
  searchMs: number;
}

function pickId(map: Record<string, unknown>, ids: string[], first: string): string {
  for (const id of ids) if (map[id]) return id;
  for (const k in map) if (ids.some((x) => k.indexOf(x) >= 0)) return k;
  return first;
}

export const DEFAULT_MODEL_ID = pickId(MODEL_INDEX, ["gemma-4-31b", "gemma-4-31b-it"], MODELS[0].id);
export const DEFAULT_GPU_ID = pickId(GPU_INDEX, ["l40s", "nvidia-l40s"], GPUS[0].id);

/** RAG & agent stack starting points. */
export const PRESETS: { id: string; label: string; ids: string[] }[] = [
  { id: "pilot", label: "Starter RAG", ids: ["bge-m3", "bge-reranker-v2-m3", "granite-docling-258m"] },
  { id: "deck", label: "Full RAG + voice", ids: ["bge-m3", "bge-reranker-v2-m3", "granite-docling-258m", "whisper-large-v3", "silma-tts"] },
  { id: "min", label: "Minimal RAG", ids: ["bge-m3", "bge-reranker-v2-m3"] },
  { id: "docs", label: "Document-heavy", ids: ["docling", "olmocr-2-7b", "bge-m3", "bge-reranker-v2-m3"] },
  { id: "voice", label: "Voice agent", ids: ["whisper-large-v3-turbo", "kokoro-82m", "bge-m3"] },
  { id: "arvoice", label: "Arabic voice", ids: ["voxtral-mini-4b-realtime-arabic", "silma-tts", "bge-m3", "bge-reranker-v2-m3"] },
  { id: "safe", label: "With guardrails", ids: ["bge-m3", "bge-reranker-v2-m3", "llama-guard-3-1b", "llama-prompt-guard-2-86m"] },
  { id: "cloud", label: "Cloud parsing + rerank", ids: ["bge-m3", "cohere-rerank-4-pro", "llamaparse"] },
  { id: "none", label: "None", ids: [] },
];

export function findCompanion(key: string): Companion | null {
  if (COMPANION_INDEX[key]) return COMPANION_INDEX[key];
  const k = key.toLowerCase();
  return (
    COMPANIONS.filter((c) => c.id.toLowerCase().indexOf(k) === 0)[0] ||
    COMPANIONS.filter((c) => c.id.toLowerCase().indexOf(k) >= 0 || (c.name || "").toLowerCase().indexOf(k) >= 0)[0] ||
    null
  );
}

export function stackItem(c: Companion): StackItem {
  return Object.assign(
    {
      id: c.id,
      prec: c.defaultPrecision || "fp16",
      place: c.api || c.arch === "api" ? "api" : c.arch === "pipeline" && c.cpuOk ? "cpu" : "gpu",
    },
    CDEF[c.task] || {},
  );
}

export function presetStack(keys: string[]): StackItem[] {
  const seen: Record<string, 1> = {};
  return keys
    .map(findCompanion)
    .filter((c): c is Companion => {
      if (!c || seen[c.id]) return false;
      seen[c.id] = 1;
      return true;
    })
    .map(stackItem);
}

export const DEFAULT_STATE: PlannerState = {
  mode: "inf",
  modelId: DEFAULT_MODEL_ID,
  custom: null,
  gpuId: DEFAULT_GPU_ID,
  customGpu: null,
  wq: "int8",
  kvq: "fp8",
  engine: "auto",
  hw: "single",
  n: 8,
  autoN: true,
  nodes: 2,
  perNode: 8,
  tp: 8,
  pp: 2,
  net: "ib400",
  users: 200,
  batch: 1,
  seq: 8192,
  out: 512,
  prefix: 0,
  offload: { on: false, by: "layers", layers: 0, pct: 0, kv: true, target: "ram", exec: "cpu" },
  host: "dual24",
  usable: 0.85,
  eta: null,
  mfu: null,
  burst: 0.05,
  chunk: 2048,
  graphs: true,
  comm: true,
  kvMode: "conservative",
  swa: true,
  keep16: true,
  prec: "fp16",
  other: 0,
  ramEff: 0.78,
  cpuTflops: 8,
  nvme: 7,
  price: null,
  kwh: 0.12,
  util: 0.6,
  powerLoad: 0.8,
  hostOverhead: 0.15,
  coresPerGpu: 6,
  appCores: 8,
  offCores: 18,
  appRam: 11,
  method: "lora",
  ftPrec: "mixed",
  optim: "adamw",
  loraR: 16,
  loraTargets: "all",
  ftBatch: 1,
  ftSeq: 4096,
  gradAccum: 8,
  zero: "none",
  samples: 20000,
  tokPerSample: 1024,
  epochs: 1,
  ckpt: true,
  flash: true,
  fused: true,
  packing: true,
  dynPad: true,
  pure16: false,
  ftMfu: null,
  ftOffOn: false,
  ftOff: { optim: false, grads: false, weights: false, act: false },
  stack: presetStack(PRESETS[0].ids),
  qpm: 1,
  searchMs: 15,
};

export function defaultState(): PlannerState {
  return structuredClone(DEFAULT_STATE);
}

/** Keys restored by "Reset advanced settings". */
export const ADVANCED_KEYS = [
  "usable", "eta", "mfu", "burst", "chunk", "graphs", "comm", "kvMode", "swa", "keep16", "prec",
  "ramEff", "cpuTflops", "nvme", "flash", "ckpt", "fused", "packing", "dynPad", "pure16", "ftMfu",
] as const satisfies readonly (keyof PlannerState)[];

export type NumericFieldKind = "pct" | "num";
export interface AdvancedField {
  key: keyof PlannerState;
  label: string;
  kind: NumericFieldKind;
  hint?: string;
}

export const ADV_INF: AdvancedField[] = [
  { key: "usable", label: "Usable GPU memory (%)", kind: "pct", hint: "Share of each GPU you plan to fill." },
  { key: "eta", label: "Bandwidth efficiency (%)", kind: "pct", hint: "Share of peak bandwidth reached while writing." },
  { key: "mfu", label: "Compute efficiency, prompts (%)", kind: "pct", hint: "MFU while reading prompts." },
  { key: "burst", label: "Users sending a prompt at once (%)", kind: "pct", hint: "Sets the first-word time under load." },
  { key: "chunk", label: "Prefill chunk (tokens)", kind: "num", hint: "Max tokens batched per step." },
  { key: "ramEff", label: "RAM bandwidth efficiency (%)", kind: "pct", hint: "For offloaded work." },
  { key: "cpuTflops", label: "CPU compute for RAM work (TFLOPS)", kind: "num" },
  { key: "nvme", label: "NVMe read speed (GB/s)", kind: "num" },
];
export const ADV_FT: AdvancedField[] = [
  { key: "ftMfu", label: "Training compute efficiency (%)", kind: "pct", hint: "MFU; empty = method default." },
];
export const ADV_COST: AdvancedField[] = [
  { key: "price", label: "GPU price ($ per GPU-hour)", kind: "num", hint: "Empty = typical cloud price." },
  { key: "kwh", label: "Electricity ($ per kWh)", kind: "num" },
  { key: "util", label: "Average utilization (%)", kind: "pct", hint: "For cost per million tokens." },
  { key: "powerLoad", label: "GPU power draw (% of TDP)", kind: "pct" },
  { key: "hostOverhead", label: "Server + cooling overhead (%)", kind: "pct" },
  { key: "coresPerGpu", label: "CPU cores per GPU", kind: "num" },
  { key: "appCores", label: "CPU cores for the app", kind: "num" },
  { key: "offCores", label: "Extra cores for work in RAM", kind: "num" },
  { key: "appRam", label: "RAM for the app (GB)", kind: "num" },
];

/** Fields that may be left empty (null = use the runtime / GPU / method default). */
export const NULLABLE_KEYS = new Set<keyof PlannerState>(["eta", "mfu", "price", "ftMfu"]);
/** Must be > 0 when set. */
export const POSITIVE_KEYS = new Set<keyof PlannerState>(["usable", "eta", "mfu", "ramEff", "ftMfu"]);
/** Must be ≥ 1. */
export const MIN_ONE_KEYS = new Set<keyof PlannerState>(["nodes", "perNode", "tp", "pp", "ftBatch", "gradAccum", "loraR", "batch", "out", "ftSeq"]);

/** Editable architecture fields for a custom model ("a.b" = nested). */
export const ARCH_FIELDS: { key: string; label: string; text?: boolean }[] = [
  { key: "name", label: "Name", text: true },
  { key: "params", label: "Total parameters (B)" },
  { key: "activeParams", label: "Active parameters (B)" },
  { key: "layers", label: "Layers" },
  { key: "hidden", label: "Hidden size" },
  { key: "heads", label: "Attention heads" },
  { key: "kvHeads", label: "KV heads" },
  { key: "headDim", label: "Head size" },
  { key: "ffn", label: "FFN size" },
  { key: "vocab", label: "Vocabulary" },
  { key: "maxCtx", label: "Max context" },
  { key: "swa.layers", label: "Sliding-window layers" },
  { key: "swa.window", label: "Window (tokens)" },
  { key: "global.kvHeads", label: "Global-layer KV heads" },
  { key: "global.headDim", label: "Global-layer head size" },
  { key: "moe.experts", label: "Experts (MoE)" },
  { key: "moe.active", label: "Experts per token" },
  { key: "moe.expertFfn", label: "Expert FFN size" },
  { key: "mla.kvLoraRank", label: "MLA latent rank" },
];

/** Editable fields for a custom GPU. */
export const CUSTOM_GPU_FIELDS: { key: keyof Gpu; label: string }[] = [
  { key: "memGB", label: "Memory (GB)" },
  { key: "bwGBs", label: "Bandwidth (GB/s)" },
  { key: "fp16", label: "16-bit TFLOPS (dense)" },
  { key: "fp8", label: "8-bit TFLOPS (dense)" },
  { key: "fp4", label: "4-bit TFLOPS (dense)" },
  { key: "pcieGen", label: "PCIe generation" },
  { key: "nvlinkGBs", label: "GPU link GB/s (0 = none)" },
  { key: "linkDomain", label: "GPUs per link domain" },
  { key: "tdpW", label: "Power (W)" },
  { key: "priceHr", label: "Price ($/h)" },
];

/** Per-task workload knobs shown on each RAG/agent stack row. */
export const STACK_FIELDS: Record<string, { key: string; label: string }[]> = {
  embedding: [{ key: "qTok", label: "Query tokens" }, { key: "chunkTok", label: "Chunk tokens" }],
  ner: [{ key: "qTok", label: "Tokens per text" }],
  reranker: [{ key: "k", label: "Passages per question" }, { key: "pTok", label: "Tokens per passage" }],
  parser: [{ key: "pages", label: "Pages to ingest" }, { key: "par", label: "Pages in parallel" }],
  asr: [{ key: "streams", label: "Live audio streams" }],
  tts: [{ key: "streams", label: "Live voices" }],
  guard: [{ key: "checks", label: "Checks per question" }, { key: "tok", label: "Tokens per check" }],
  vlm: [{ key: "tok", label: "Input tokens" }, { key: "out", label: "Output tokens" }],
  router: [{ key: "tok", label: "Input tokens" }, { key: "out", label: "Output tokens" }],
};
