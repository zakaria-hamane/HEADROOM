import { defaultState, PRESETS, presetStack, type PlannerState } from "./defaults";

export interface PlanTemplate {
  id: string;
  title: string;
  description: string;
  mode: "inf" | "ft";
  apply: Partial<PlannerState>;
}

const stackOf = (id: string) => presetStack(PRESETS.find((p) => p.id === id)?.ids ?? []);

export const TEMPLATES: PlanTemplate[] = [
  {
    id: "team-assistant",
    title: "Team assistant with RAG",
    description: "Gemma 4 31B on L40S for 200 people, embeddings, reranker and document parsing.",
    mode: "inf",
    apply: {},
  },
  {
    id: "llama-70b-h100",
    title: "Llama 3.3 70B on H100",
    description: "FP8 weights and KV cache, 100 concurrent users with 16K context.",
    mode: "inf",
    apply: { modelId: "llama-3.3-70b", gpuId: "h100-sxm", wq: "fp8", kvq: "fp8", users: 100, seq: 16384, stack: [] },
  },
  {
    id: "moe-cluster",
    title: "DeepSeek V3 on a B200 cluster",
    description: "2 nodes × 8 B200, TP 8 × PP 2, 256 users, 16K context.",
    mode: "inf",
    apply: {
      modelId: "deepseek-v3", gpuId: "b200", wq: "fp8", kvq: "fp8", hw: "cluster", nodes: 2, perNode: 8, tp: 8, pp: 2,
      users: 256, seq: 16384, stack: [],
    },
  },
  {
    id: "local-coder",
    title: "Local coding assistant",
    description: "Qwen3-Coder 30B-A3B in GGUF Q4_K_M on one RTX 4090.",
    mode: "inf",
    apply: { modelId: "qwen3-coder-30b-a3b", gpuId: "rtx-4090", wq: "q4_k_m", kvq: "q8_0", users: 1, seq: 32768, stack: [] },
  },
  {
    id: "mac-studio",
    title: "gpt-oss-120b on a Mac",
    description: "MXFP4 weights on Apple M3 Ultra unified memory, single user.",
    mode: "inf",
    apply: { modelId: "gpt-oss-120b", gpuId: "m3-ultra", wq: "mxfp4", kvq: "fp16", users: 1, seq: 32768, stack: [] },
  },
  {
    id: "voice-agent",
    title: "Voice agent",
    description: "Qwen3 8B with Whisper Turbo speech-to-text and Kokoro text-to-speech on L4.",
    mode: "inf",
    apply: { modelId: "qwen3-8b", gpuId: "l4", wq: "fp8", kvq: "fp8", users: 25, seq: 8192, stack: stackOf("voice") },
  },
  {
    id: "qlora-8b",
    title: "QLoRA fine-tune of an 8B",
    description: "Qwen3 8B, rank 16 on all linear layers, on one RTX 4090.",
    mode: "ft",
    apply: { mode: "ft", modelId: "qwen3-8b", gpuId: "rtx-4090", method: "qlora", optim: "paged8" },
  },
  {
    id: "full-70b",
    title: "Full fine-tune of a 70B",
    description: "Llama 3.3 70B with ZeRO-3 / FSDP on one 8× B200 server, 100K samples.",
    mode: "ft",
    apply: { mode: "ft", modelId: "llama-3.3-70b", gpuId: "b200", method: "full", zero: "zero3", samples: 100000, ftSeq: 4096 },
  },
];

export function templateState(id: string): PlannerState | null {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return null;
  return { ...defaultState(), ...structuredClone(t.apply) };
}
