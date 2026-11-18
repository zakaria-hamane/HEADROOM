/* LLM sizing engine v2 — TypeScript port of the original LLM GPU Planner engine. Pure functions, no DOM.
   Memory in GiB (shown as "GB", as nvidia-smi and most calculators do). Bandwidth GB/s and TFLOPS are decimal.
   Keep the arithmetic in sync with tests/fixtures/original-engine.cjs (see tests/engine.parity.test.ts). */

import type { Companion, Gpu, Model, StackItem } from "./types";

export type { Catalog, Companion, CompanionTask, Gpu, Model, StackItem } from "./types";

export const GiB = 1073741824;

// ---------- precision tables
export type ComputeClass = "fp16" | "fp8" | "int8" | "fp4";
/** b = bits per weight (incl. scales); keep16 = embeddings / LM head usually stay 16-bit in this format; c = compute class */
export interface WeightFormat {
  l: string;
  b: number;
  c: ComputeClass;
  keep16?: boolean;
  gguf?: boolean;
}

export const WQ: Record<string, WeightFormat> = {
  fp32: { l: "FP32", b: 32, c: "fp16" },
  bf16: { l: "BF16 / FP16", b: 16, c: "fp16" },
  fp8: { l: "FP8 (W8A8)", b: 8, c: "fp8", keep16: true },
  int8: { l: "INT8 (W8A8 / W8A16)", b: 8, c: "int8", keep16: true },
  awq: { l: "INT4 AWQ / GPTQ", b: 4.25, c: "fp16", keep16: true },
  nvfp4: { l: "NVFP4", b: 4.5, c: "fp4", keep16: true },
  mxfp4: { l: "MXFP4", b: 4.25, c: "fp4", keep16: true },
  q8_0: { l: "GGUF Q8_0", b: 8.5, c: "fp16", gguf: true },
  q6_k: { l: "GGUF Q6_K", b: 6.56, c: "fp16", gguf: true },
  q5_k_m: { l: "GGUF Q5_K_M", b: 5.69, c: "fp16", gguf: true },
  q5_k_s: { l: "GGUF Q5_K_S", b: 5.54, c: "fp16", gguf: true },
  q4_k_m: { l: "GGUF Q4_K_M", b: 4.89, c: "fp16", gguf: true },
  q4_k_s: { l: "GGUF Q4_K_S", b: 4.58, c: "fp16", gguf: true },
  q4_0: { l: "GGUF Q4_0", b: 4.5, c: "fp16", gguf: true },
  iq4_xs: { l: "GGUF IQ4_XS", b: 4.25, c: "fp16", gguf: true },
  q3_k_m: { l: "GGUF Q3_K_M", b: 3.91, c: "fp16", gguf: true },
  iq3_xxs: { l: "GGUF IQ3_XXS", b: 3.06, c: "fp16", gguf: true },
  q2_k: { l: "GGUF Q2_K", b: 3.35, c: "fp16", gguf: true },
  iq2_xxs: { l: "GGUF IQ2_XXS", b: 2.06, c: "fp16", gguf: true },
  iq1_s: { l: "GGUF IQ1_S", b: 1.56, c: "fp16", gguf: true },
};

export interface KvFormat {
  l: string;
  b: number;
}
export const KQ: Record<string, KvFormat> = {
  fp32: { l: "FP32", b: 4 },
  fp16: { l: "FP16 / BF16", b: 2 },
  fp8: { l: "FP8", b: 1 },
  q8_0: { l: "Q8_0 (llama.cpp)", b: 1.0625 },
  q5_1: { l: "Q5_1 (llama.cpp)", b: 0.75 },
  q4_0: { l: "Q4_0 (llama.cpp)", b: 0.5625 },
  fp4: { l: "NVFP4 (TensorRT-LLM)", b: 0.5625 },
};

/** Inference runtimes: GB per GPU for framework / CUDA graphs / multi-GPU buffers; eta = share of peak memory
 *  bandwidth reached while writing; mfu = share of peak compute reached while reading prompts. */
export interface RuntimeEngine {
  l: string;
  ovh: [number, number];
  fw: number;
  graphs: number;
  comm: number;
  eta: number;
  mfu: number;
  kv: string[];
  paged: boolean;
}
export const ENGINES: Record<string, RuntimeEngine> = {
  vllm: { l: "vLLM", ovh: [0.8, 0.012], fw: 0.75, graphs: 0.6, comm: 0.8, eta: 0.55, mfu: 0.5, kv: ["fp16", "fp8", "fp32"], paged: true },
  sglang: { l: "SGLang", ovh: [0.7, 0.01], fw: 0.75, graphs: 0.6, comm: 0.8, eta: 0.58, mfu: 0.52, kv: ["fp16", "fp8", "fp32"], paged: true },
  trtllm: { l: "TensorRT-LLM", ovh: [0.5, 0.008], fw: 0.6, graphs: 0.4, comm: 0.8, eta: 0.62, mfu: 0.58, kv: ["fp16", "fp8", "fp4", "fp32"], paged: true },
  llamacpp: { l: "llama.cpp / Ollama", ovh: [1.5, 0.03], fw: 0.35, graphs: 0.15, comm: 0.3, eta: 0.5, mfu: 0.35, kv: ["fp16", "q8_0", "q5_1", "q4_0", "fp32"], paged: false },
  exllama: { l: "ExLlamaV3", ovh: [1.0, 0.02], fw: 0.4, graphs: 0.1, comm: 0.3, eta: 0.55, mfu: 0.4, kv: ["fp16", "q8_0", "q4_0"], paged: true },
  mlx: { l: "MLX (Apple)", ovh: [1.5, 0.03], fw: 0.3, graphs: 0, comm: 0, eta: 0.6, mfu: 0.4, kv: ["fp16", "q8_0", "q4_0"], paged: false },
  hf: { l: "HF Transformers", ovh: [5, 0.12], fw: 1.0, graphs: 0, comm: 0.5, eta: 0.3, mfu: 0.35, kv: ["fp16", "fp8", "fp32"], paged: false },
};

export interface Network {
  l: string;
  bw: number;
  lat: number;
}
export const NETS: Record<string, Network> = {
  ib800: { l: "InfiniBand XDR / 800G per GPU", bw: 100, lat: 4e-6 },
  ib400: { l: "InfiniBand NDR / 400G per GPU", bw: 50, lat: 5e-6 },
  ib200: { l: "InfiniBand HDR / 200G per GPU", bw: 25, lat: 6e-6 },
  eth400: { l: "Ethernet RoCE 400G per GPU", bw: 50, lat: 8e-6 },
  eth100: { l: "Ethernet 100G per node", bw: 12.5, lat: 15e-6 },
};

export const HOSTS: Record<string, { l: string; bw: number }> = {
  dual24: { l: "2 CPUs · 24 ch DDR5-5600", bw: 1075 },
  dual16: { l: "2 CPUs · 16 ch DDR5-4800", bw: 614 },
  single12: { l: "1 CPU · 12 ch DDR5-5600", bw: 538 },
  single8: { l: "1 CPU · 8 ch DDR5-4800", bw: 307 },
  desktop: { l: "Desktop · 2 ch DDR5-6000", bw: 96 },
};

export const PCIE: Record<number, number> = { 3: 12, 4: 25, 5: 50, 6: 100 };
export const STD_RAM = [16, 32, 64, 128, 256, 512, 768, 1024, 1536, 2048, 3072, 4096];
export const STD_CPU = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];

/** Bytes per trainable parameter for optimizer states (incl. FP32 master copy where the scheme keeps one). */
export interface Optimizer {
  l: string;
  mixed: number;
  fp32: number;
  pure: number;
  paged?: boolean;
}
export const OPTIM: Record<string, Optimizer> = {
  adamw: { l: "AdamW", mixed: 12, fp32: 8, pure: 4 },
  adamw8: { l: "AdamW 8-bit", mixed: 6, fp32: 2, pure: 2 },
  paged8: { l: "Paged AdamW 8-bit", mixed: 6, fp32: 2, pure: 2, paged: true },
  lion: { l: "Lion", mixed: 8, fp32: 4, pure: 2 },
  adafactor: { l: "Adafactor", mixed: 4.1, fp32: 0.1, pure: 0.1 },
  sgd: { l: "SGD + momentum", mixed: 8, fp32: 4, pure: 2 },
};

/** Settings the engine reads. The planner state is a superset of this. */
export interface OffloadSettings {
  on?: boolean;
  by?: "layers" | "pct" | string;
  layers?: number;
  pct?: number;
  kv?: boolean;
  target?: "ram" | "nvme" | string;
  exec?: "cpu" | "pcie" | string;
}
export interface EngineSettings {
  wq?: string;
  kvq?: string;
  engine?: string;
  hw?: "single" | "cluster" | string;
  n?: number;
  nodes?: number;
  perNode?: number;
  tp?: number;
  pp?: number;
  net?: string;
  users?: number;
  batch?: number;
  seq?: number;
  out?: number;
  prefix?: number;
  offload?: OffloadSettings;
  host?: string;
  usable?: number;
  eta?: number | null;
  mfu?: number | null;
  burst?: number;
  chunk?: number;
  graphs?: boolean;
  graphsGB?: number;
  fw?: number;
  commGB?: number;
  comm?: boolean;
  kvMode?: string;
  swa?: boolean;
  keep16?: boolean;
  prec?: string;
  other?: number;
  ramEff?: number;
  cpuTflops?: number;
  nvme?: number;
  overheadMs?: number;
  price?: number | null;
  kwh?: number;
  util?: number;
  powerLoad?: number;
  hostOverhead?: number;
  coresPerGpu?: number;
  appCores?: number;
  offCores?: number;
  appRam?: number;
  // fine-tuning
  method?: "full" | "lora" | "qlora" | string;
  ftPrec?: "mixed" | "pure" | "fp32" | string;
  optim?: string;
  loraR?: number;
  loraTargets?: "attn" | "all" | string;
  ftBatch?: number;
  ftSeq?: number;
  gradAccum?: number;
  zero?: "none" | "zero1" | "zero2" | "zero3" | string;
  samples?: number;
  tokPerSample?: number;
  epochs?: number;
  ckpt?: boolean;
  flash?: boolean;
  fused?: boolean;
  packing?: boolean;
  dynPad?: boolean;
  pure16?: boolean;
  ftMfu?: number | null;
  ftOffOn?: boolean;
  ftOff?: { optim?: boolean; grads?: boolean; weights?: boolean; act?: boolean };
}

// ---------- helpers
export function num(x: unknown, d: number): number {
  return typeof x === "number" && isFinite(x) ? x : d;
}
/** `x | 0` semantics of the original (ToInt32 coercion). */
function int(x: unknown): number {
  return Number(x) | 0;
}
export function roundUp(x: number, list: number[]): number {
  for (let i = 0; i < list.length; i++) if (list[i] >= x - 1e-9) return list[i];
  const l = list[list.length - 1];
  return Math.ceil(x / l) * l;
}

export type NormModel = Omit<Model, "layers" | "hidden" | "heads" | "kvHeads" | "headDim" | "ffn" | "vocab" | "activeParams" | "maxCtx" | "embedParams" | "tied"> & {
  layers: number;
  hidden: number;
  heads: number;
  kvHeads: number;
  headDim: number;
  ffn: number;
  vocab: number;
  params: number;
  activeParams: number;
  maxCtx: number;
  embedParams: number;
  tied: boolean;
  linearN: number;
  linearStateMB: number;
  linearKind?: string;
};

export function normModel(m: Model): NormModel {
  const o = Object.assign({}, m) as unknown as NormModel;
  o.layers = num(o.layers, 32);
  o.hidden = num(o.hidden, 4096);
  o.heads = num(o.heads, 32);
  o.kvHeads = num(o.kvHeads, o.heads);
  o.headDim = num(o.headDim, o.hidden / o.heads);
  o.ffn = num(o.ffn, o.hidden * 4);
  o.vocab = num(o.vocab, 32000);
  o.params = num(o.params, 7);
  o.activeParams = num(o.activeParams, o.params);
  o.maxCtx = num(o.maxCtx, 131072);
  o.embedParams = num(o.embedParams, (o.vocab * o.hidden) / 1e9);
  o.tied = !!o.tied;
  const ll = o.linearLayers;
  if (ll && typeof ll === "object") {
    o.linearN = num(ll.layers, 0);
    o.linearStateMB = num(ll.stateMB, 0);
    o.linearKind = ll.kind || "linear";
  } else {
    o.linearN = num(ll, 0);
    o.linearStateMB = num(o.linearStateMB, 0);
  }
  return o;
}

/** Billions of parameters held in routed experts. */
export function expertParams(m: NormModel): number {
  if (!m.moe || !m.moe.experts) return 0;
  const ffn = num(m.moe.expertFfn, m.ffn),
    moeLayers = m.layers - num(m.moe.denseLayers, 0);
  return Math.min(m.params * 0.985, (moeLayers * m.moe.experts * 3 * m.hidden * ffn) / 1e9);
}

export function weightsGiB(m: NormModel, q: { b: number; keep16?: boolean }, keep16: boolean): number {
  const emb = m.embedParams * (m.tied ? 1 : 2),
    body = Math.max(0, m.params - emb);
  const embBits = keep16 && q.keep16 ? 16 : q.b;
  return ((body * q.b + emb * embBits) * 1e9) / 8 / GiB;
}

function attnLayers(m: NormModel): number {
  return Math.max(0, m.layers - num(m.linearN, 0));
}

export interface KvPart {
  kind: string;
  layers: number;
  kvh: number;
  hd: number;
  kv: number;
  tokens: number;
  rep: number;
  bytes: number;
}
export interface KvSeq {
  parts: KvPart[];
  logical: number;
  stored: number;
  perToken: number;
}

/** KV cache for one sequence holding S tokens. exact = use the special global-layer layout; swa = sliding layers keep only the window. */
export function kvSeq(m: NormModel, S: number, kvB: number, exact: boolean, swa: boolean, tp: number): KvSeq {
  const parts: KvPart[] = [],
    A = attnLayers(m),
    kc = m.kvCompression,
    sh = m.kvSharedLayers || {};
  const push = (p: Omit<KvPart, "bytes">) => parts.push({ ...p, bytes: 0 });
  if (kc && (kc.growingElemsPerToken || kc.documentedBytesPerToken)) {
    if (kc.growingElemsPerToken) {
      push({ kind: "compressed (growing)", layers: 1, kvh: 1, hd: kc.growingElemsPerToken, kv: 1, tokens: S, rep: tp });
      if (kc.windowElemsPerSeq) push({ kind: "compressed (window)", layers: 1, kvh: 1, hd: kc.windowElemsPerSeq, kv: 1, tokens: 1, rep: tp });
    } else push({ kind: "compressed (documented)", layers: 1, kvh: 1, hd: (kc.documentedBytesPerToken as number) / kvB, kv: 1, tokens: S, rep: tp });
  } else if (m.mla && m.mla.kvLoraRank) {
    push({ kind: "MLA latent", layers: A, kvh: 1, hd: m.mla.kvLoraRank + num(m.mla.qkRopeHeadDim, 64), kv: 1, tokens: S, rep: tp });
  } else {
    const sw = m.swa && m.swa.layers ? Math.min(A, m.swa.layers) : 0;
    if (sw && sw - num(sh.sliding, 0) > 0)
      push({
        kind: "sliding-window",
        layers: sw - num(sh.sliding, 0),
        kvh: m.kvHeads,
        hd: m.headDim,
        kv: 2,
        tokens: swa ? Math.min(S, m.swa!.window as number) : S,
        rep: tp > m.kvHeads ? tp / m.kvHeads : 1,
      });
    const gl = A - sw - num(sh.full, 0);
    if (gl > 0) {
      const g = exact && m.global ? m.global : null,
        kvh = (g && g.kvHeads) || m.kvHeads,
        hd = (g && g.headDim) || m.headDim;
      push({ kind: sw ? "global" : "attention", layers: gl, kvh, hd, kv: g && g.kvShared ? 1 : 2, tokens: S, rep: tp > kvh ? tp / kvh : 1 });
    }
  }
  let logical = 0,
    stored = 0;
  parts.forEach((p) => {
    p.bytes = p.layers * p.kvh * p.hd * p.kv * p.tokens * kvB;
    logical += p.bytes;
    stored += p.bytes * p.rep;
  });
  const state = num(m.linearStateMB, 0) * 1048576;
  return { parts, logical: logical + state, stored: stored + state, perToken: S ? logical / S : 0 };
}

function attnDim(m: NormModel): number {
  return m.mla
    ? (m.heads * (num(m.mla.qkNopeHeadDim, 128) + num(m.mla.qkRopeHeadDim, 64) + num(m.mla.vHeadDim, 128))) / 2
    : m.heads * m.headDim;
}

/** FLOPs for one new token with `ctx` tokens already attended (decode), using active parameters. */
export function decodeFlops(m: NormModel, ctx: number, swa: boolean): number {
  const A = attnLayers(m),
    sw = m.swa && m.swa.layers ? Math.min(A, m.swa.layers) : 0,
    d = attnDim(m);
  const att = 4 * d * ((A - sw) * ctx + sw * (swa && m.swa ? Math.min(ctx, m.swa.window as number) : ctx));
  return 2 * m.activeParams * 1e9 + att;
}

/** FLOPs to read a prompt of P new tokens after `pre` cached tokens. */
export function prefillFlops(m: NormModel, P: number, pre: number, swa: boolean): number {
  const A = attnLayers(m),
    sw = m.swa && m.swa.layers ? Math.min(A, m.swa.layers) : 0,
    d = attnDim(m);
  const avg = pre + P / 2,
    win = swa && m.swa ? Math.min(avg, m.swa.window as number) : avg;
  return P * (2 * m.activeParams * 1e9 + 4 * d * ((A - sw) * avg + sw * win));
}

export interface Link {
  kind: string;
  bw: number;
  lat: number;
}
function pcieOf(gen: number | null | undefined): number | undefined {
  return gen != null ? PCIE[gen] : undefined;
}
function linkFor(g: Gpu, tp: number, perNode: number, net: string | undefined): Link {
  if (tp <= perNode && num(g.nvlinkGBs, 0) > 0 && tp <= num(g.linkDomain, 1))
    return {
      kind: g.vendor === "AMD" ? "Infinity Fabric" : g.vendor === "Google" ? "ICI" : "NVLink",
      bw: (g.nvlinkGBs as number) / 2,
      lat: 5e-6,
    };
  if (tp <= perNode) return { kind: "PCIe Gen" + (g.pcieGen || 4), bw: (pcieOf(g.pcieGen) || 25) * 0.8, lat: 12e-6 };
  const n = (net && NETS[net]) || NETS.ib400;
  return { kind: n.l, bw: n.bw, lat: n.lat };
}
/** Host link: PCIe x16, or NVLink-C2C (450 GB/s each way) on Grace superchips. */
function hostLinkGBs(g: Gpu): number {
  return g.pcieGen ? pcieOf(g.pcieGen) || 25 : /^g[bh]\d/.test(g.id || "") ? 450 : 25;
}
function allReduce(msg: number, n: number, link: { bw: number; lat: number }): number {
  return n > 1 ? (((2 * (n - 1)) / n) * msg) / (link.bw * 1e9) + 2 * (n - 1) * link.lat : 0;
}
function tflopsFor(g: Gpu, c: ComputeClass, prec: string | undefined): number {
  const f16 = num(g.fp16, 0);
  if (prec === "eight") {
    if (c === "fp8" && g.fp8) return g.fp8;
    if (c === "int8" && g.int8) return g.int8;
    if (c === "fp4" && (g.fp8 || g.int8)) return (g.fp8 || g.int8) as number;
  }
  if (prec === "four" && c === "fp4" && g.fp4) return g.fp4;
  return f16;
}

export interface Topology {
  G: number;
  tp: number;
  pp: number;
  dp: number;
  rep: number;
  perNode: number;
  idle: number;
  valid: boolean;
}
export function topology(s: EngineSettings): Topology {
  let G: number, tp: number, pp: number, perNode: number;
  if (s.hw === "cluster") {
    perNode = Math.max(1, int(s.perNode));
    G = Math.max(1, int(s.nodes)) * perNode;
    tp = Math.max(1, int(s.tp));
    pp = Math.max(1, int(s.pp));
  } else {
    perNode = Math.max(1, int(s.n));
    G = perNode;
    tp = G;
    pp = 1;
  }
  const rep = tp * pp,
    dp = Math.max(1, Math.floor(G / rep));
  return { G, tp, pp, dp, rep, perNode, idle: G - dp * rep, valid: rep <= G };
}

// ---------- inference
export function inference(s: EngineSettings, gpu: Gpu, model: Model, nOverride?: number) {
  const m = normModel(model),
    g = gpu,
    q = WQ[s.wq as string] || WQ.bf16,
    kq = KQ[s.kvq as string] || KQ.fp16;
  const engKey = s.engine === "auto" ? autoEngine(s.wq, g) : (s.engine as string),
    E = ENGINES[engKey] || ENGINES.vllm;
  const st = nOverride ? Object.assign({}, s, { hw: "single", n: nOverride }) : s;
  const T = topology(st),
    tp = T.tp,
    pp = T.pp;
  const users = Math.max(1, Math.round(s.users as number)),
    seqs = users * Math.max(1, Math.round(s.batch || 1));
  const Br = Math.ceil(seqs / T.dp);
  const S = Math.max(16, Math.round(s.seq as number)),
    O = Math.min(Math.max(1, Math.round(s.out || 512)), S - 1),
    P = S - O;
  const pre = Math.min(Math.max(0, Math.round(s.prefix || 0)), P);
  const eta = num(s.eta, E.eta),
    mfu = num(s.mfu, E.mfu);
  const W = weightsGiB(m, q, s.keep16 !== false);
  const Ep = expertParams(m),
    expFrac = m.params ? Ep / m.params : 0;
  const kv = kvSeq(m, S, kq.b, s.kvMode === "exact", s.swa !== false, tp);
  const kvUserGpu = kv.stored / GiB,
    kvUserRam = kv.logical / GiB;
  const prefixShare = pre / S; // share of each sequence's KV that is a shared, cached prefix
  // offloading
  const offS: OffloadSettings = s.offload || {};
  const off = !!(s.offload && s.offload.on),
    L = m.layers;
  const fW = off ? (offS.by === "pct" ? Math.min(1, num(offS.pct, 0) / 100) : Math.min(1, num(offS.layers, 0) / L)) : 0;
  const kvOff = !!(off && offS.kv);
  const W_off = W * fW,
    W_gpu = W - W_off;
  const kvMemPerSeq = kvUserGpu * (1 - prefixShare); // private part
  const KV_gpu = kvOff ? 0 : Br * kvMemPerSeq + kvUserGpu * prefixShare;
  const KV_off = kvOff ? Br * kvUserRam * (1 - prefixShare) + kvUserRam * prefixShare : 0;
  const offBytes = W_off + KV_off;
  // runtime memory for one replica (tp x pp GPUs)
  const nRep = T.rep;
  const fw = num(s.fw, E.fw) * nRep,
    graphs = (s.graphs === false ? 0 : num(s.graphsGB, E.graphs)) * nRep,
    comm = nRep > 1 ? num(s.commGB, E.comm) * nRep : 0;
  const ffnEff = m.moe
    ? num(m.moe.expertFfn, m.ffn) * num(m.moe.active, 2) + num(m.moe.sharedFfn, num(m.moe.expertFfn, m.ffn)) * num(m.moe.shared, 0)
    : m.ffn;
  const chunk = Math.max(256, num(s.chunk, 2048));
  const act = (nRep * (chunk * (6 * m.hidden + (3 * ffnEff) / tp) * 2 + (Br * m.vocab * 4) / tp)) / GiB;
  const other = num(s.other, 0);
  const shared = W_gpu + fw + graphs + comm + act;
  const llm = shared + KV_gpu,
    used = llm + other;
  const memGB = num(g.memGB, 24),
    usableFrac = num(s.usable, 0.9);
  const totalRep = nRep * memGB,
    usablePerGpu = memGB * usableFrac,
    usableRep = nRep * usablePerGpu;
  const ratio = used / usableRep,
    fits = used <= usableRep + 1e-9 && T.valid;
  // compute / bandwidth
  const tfPer = tflopsFor(g, q.c, s.prec),
    TFrep = nRep * tfPer * 1e12;
  const bw = num(g.bwGBs, 500) * 1e9 * eta;
  const touched =
    m.moe && m.moe.experts ? 1 - Math.pow(1 - Math.min(1, num(m.moe.active, 2) / m.moe.experts), Math.max(1, Br / pp)) : 1;
  const Wexp_gpu = W_gpu * expFrac,
    Wdense_gpu = W_gpu - Wexp_gpu;
  const bytesW = (Wdense_gpu + Wexp_gpu * touched) * GiB;
  const bytesKV = kvOff ? 0 : Br * kvUserGpu * GiB;
  const tMem = (bytesW / tp + bytesKV / (tp * pp)) / bw;
  const Fdec = decodeFlops(m, S, s.swa !== false);
  const cpuExec = off && offS.exec !== "pcie" && offBytes > 0;
  const attnShare = 1 - (2 * m.activeParams * 1e9) / Fdec;
  const Fcpu = cpuExec ? Fdec * ((1 - attnShare) * fW + attnShare * (kvOff ? 1 : fW)) : 0;
  const tComp = (Br * (Fdec - Fcpu)) / (TFrep * mfu);
  const link = linkFor(g, tp, T.perNode, s.net);
  let tComm = 0,
    tP2p = 0;
  if (s.comm !== false && tp > 1) tComm = 2 * m.layers * allReduce((Br / pp) * m.hidden * 2, tp, link);
  if (pp > 1) {
    const pl = T.perNode >= tp * pp ? linkFor(g, 2, T.perNode, s.net) : (s.net && NETS[s.net]) || NETS.ib400;
    tP2p = (pp - 1) * (pl.lat + ((Br / pp) * m.hidden * 2) / (pl.bw * 1e9));
  }
  let tOff = 0,
    tRam = 0,
    tCpu = 0,
    offBw = 0,
    offBound = "";
  const pcie = hostLinkGBs(g),
    host = (s.host && HOSTS[s.host]) || HOSTS.dual24;
  if (offBytes > 0) {
    if (cpuExec) {
      offBw = offS.target === "nvme" ? num(s.nvme, 7) : host.bw * num(s.ramEff, 0.78);
      tRam = (offBytes * GiB) / (offBw * 1e9);
      tCpu = (Br * Fcpu) / (num(s.cpuTflops, 8) * 1e12);
      tOff = Math.max(tRam, tCpu);
      offBound = tRam >= tCpu ? (offS.target === "nvme" ? "nvme" : "ram") : "cpu";
    } else {
      offBw = Math.min(nRep * pcie, offS.target === "nvme" ? num(s.nvme, 7) : Infinity);
      tOff = (offBytes * GiB) / (offBw * 1e9);
      offBound = offS.target === "nvme" ? "nvme" : "pcie";
    }
  }
  const tOvh = (E.ovh[0] + E.ovh[1] * m.layers * (s.graphs === false && E.graphs ? 3 : 1)) / 1000;
  const tGpu = Math.max(tMem, tComp),
    tStep = tGpu + tComm + tP2p + tOff + tOvh;
  const speed = 1 / tStep,
    thr = seqs * speed;
  const bound = tOff > tGpu + tComm ? offBound : tComm + tP2p > tGpu ? "comm" : tComp > tMem ? "compute" : "bandwidth";
  // first word
  const k = Math.max(1, Math.round(users * num(s.burst, 0.05)));
  const Fpre = prefillFlops(m, P - pre, pre, s.swa !== false);
  const ppEff = pp > 1 ? pp * 0.9 : 1,
    tfPre = tp * tfPer * 1e12 * ppEff * mfu;
  const tPre = Fpre / tfPre;
  const wFloor = (Math.ceil(Math.max(1, P - pre) / chunk) * (Wdense_gpu + Wexp_gpu) * GiB) / (tp * bw);
  const prefComm =
    s.comm !== false && tp > 1 ? 2 * m.layers * Math.ceil(Math.max(1, P - pre) / chunk) * allReduce(chunk * m.hidden * 2, tp, link) : 0;
  const hostLink = nRep * pcie;
  const kvWrite = kvOff ? (kvUserRam * (1 - prefixShare) * GiB) / (hostLink * 1e9) : 0;
  const wStream = W_off > 0 ? (W_off * GiB) / (Math.min(hostLink, offS.target === "nvme" ? num(s.nvme, 7) : Infinity) * 1e9) : 0;
  const one = Math.max(tPre, wFloor) + prefComm + kvWrite;
  const ttft1 = one + wStream + num(s.overheadMs, 30) / 1000;
  const ttftK = k * one + wStream + num(s.overheadMs, 30) / 1000;
  // capacity
  const totalTF = T.G * tfPer;
  const computeTF = (thr * Fdec) / 1e12,
    share = computeTF / totalTF;
  const free = usableRep - (shared + other);
  const maxSeqs = kvOff ? Infinity : Math.max(0, Math.floor(free / Math.max(1e-9, kvMemPerSeq) + 1e-9)) * T.dp;
  // money and power
  const price = num(s.price, num(g.priceHr, 0)),
    util = num(s.util, 0.6);
  const power = T.G * num(g.tdpW, g.unified ? 120 : 300) * num(s.powerLoad, 0.8) * (1 + num(s.hostOverhead, 0.15));
  const costHr = T.G * price + (power / 1000) * num(s.kwh, 0.12);
  const tokensHr = thr * 3600 * util;
  // server
  const coresRaw = num(s.coresPerGpu, 6) * T.G + num(s.appCores, 8) + (cpuExec ? num(s.offCores, 18) : 0);
  const ramNeed = num(s.appRam, 11) + Math.max(W + other, offBytes);
  const warn: string[] = [];
  if (!T.valid) warn.push("TP × PP (" + T.rep + ") is larger than the number of GPUs (" + T.G + ").");
  if (T.idle) warn.push(T.idle + " GPU(s) left idle: total GPUs is not a multiple of TP × PP.");
  if (S > m.maxCtx)
    warn.push("The context (" + S.toLocaleString("en-US") + ") is longer than the model supports (" + m.maxCtx.toLocaleString("en-US") + ").");
  if (tp > 1 && m.heads % tp) warn.push("Tensor parallelism needs the attention heads (" + m.heads + ") to divide by TP (" + tp + ").");
  if (tp > T.perNode) warn.push("TP spans several nodes: every layer waits for the network. Keep TP inside a node and use PP across nodes.");
  if (tp > 1 && link.kind.indexOf("PCIe") === 0) warn.push("No NVLink between these " + tp + " GPUs: tensor-parallel traffic crosses PCIe (counted).");
  if (E.kv.indexOf(s.kvq as string) < 0) warn.push(E.l + " does not offer a " + kq.l + " KV cache.");
  if (q.gguf && ["vllm", "sglang", "trtllm"].indexOf(engKey) >= 0) warn.push("GGUF formats run best in llama.cpp / Ollama; " + E.l + " support is limited.");
  if (s.prec === "eight" && q.c !== "fp8" && q.c !== "int8" && q.c !== "fp4") warn.push("8-bit compute needs FP8 / INT8 weights and activations (W8A8).");
  if (q.c === "fp4" && !g.fp4) warn.push((g.name || "This GPU") + " has no FP4 tensor cores: the weights are unpacked to 16-bit for compute.");
  if (q.c === "fp8" && !g.fp8) warn.push((g.name || "This GPU") + " has no FP8 tensor cores: FP8 runs as weight-only (W8A16) here.");
  if (off && offS.target === "nvme" && kvOff) warn.push("KV cache on NVMe is far too slow for interactive use.");
  if (kv.parts.some((p) => p.rep > 1)) warn.push("More GPUs than KV heads on some layers: their KV cache is copied on several GPUs (counted).");
  if (g.unified) warn.push('Unified memory: part of it is used by the OS and apps; lower "usable memory" if needed.');
  return {
    engine: engKey, E, T, model: m, gpu: g, q, kq, users, seqs, Br, S, O, P, pre,
    W, W_gpu, W_off, fW, Ep, expFrac, touched, kv, kvUserGpu, kvUserRam,
    kvOff, KV_gpu, KV_off, offBytes, fw, graphs, comm, act, other,
    shared, llm, used, totalRep, total: T.G * memGB, usablePerGpu, usableRep,
    ratio, fits, eta, mfu, tfPer, Fdec, Fcpu, Fpre, bytesW: bytesW / GiB, bytesKV: bytesKV / GiB,
    tMem, tComp, tOvh, tComm, tP2p, tOff, tRam, tCpu, offBw, tStep, link,
    speed, thr, bound, cpuExec, k, tPre, wFloor, prefComm, kvWrite, wStream,
    ttft1, ttftK, computeTF, totalTF, share, maxSeqs,
    price, power, costHr, perMTok: tokensHr > 0 ? (costHr / tokensHr) * 1e6 : Infinity, util,
    kwhPerMTok: thr > 0 ? (power / 1000 / (thr * 3600)) * 1e6 : Infinity,
    coresRaw, cores: roundUp(coresRaw, STD_CPU), ramNeed, ram: roundUp(ramNeed, STD_RAM), warn,
  };
}
export type InferenceResult = ReturnType<typeof inference>;

export function autoEngine(wq: string | undefined, g: Gpu | null | undefined): string {
  const q: Partial<WeightFormat> = WQ[wq as string] || {};
  if (g && g.vendor === "Apple") return "mlx";
  if (q.gguf) return "llamacpp";
  if (wq === "nvfp4") return "trtllm";
  return "vllm";
}

/** Single-rig devices (unified memory, Apple, edge) can't be stacked into multi-GPU servers. */
export function single(g: Gpu): boolean {
  return !!(g.unified || g.segment === "apple" || g.segment === "edge");
}

/** Smallest single-rig GPU count (1, 2, 4, 8, 16) that fits. */
export function minGpus(s: EngineSettings, gpu: Gpu, model: Model): { n: number | null; r: InferenceResult } {
  const opts = single(gpu) ? [1] : [1, 2, 4, 8, 16];
  for (let i = 0; i < opts.length; i++) {
    const r = inference(s, gpu, model, opts[i]);
    if (r.fits) return { n: opts[i], r };
  }
  return { n: null, r: inference(s, gpu, model, 16) };
}

/** Every GPU in the catalog: smallest count that fits, speed, first word, cost. */
export function compareAll(s: EngineSettings, gpus: Gpu[], model: Model) {
  return gpus.map((g) => {
    const x = minGpus(s, g, model),
      r = x.r;
    return {
      gpu: g, n: x.n, fits: !!x.n, speed: r.speed, ttft: r.ttftK, thr: r.thr,
      costHr: x.n ? r.costHr : null, perMTok: x.n ? r.perMTok : null, power: r.power, ratio: r.ratio,
    };
  });
}

// ---------- fine-tuning
export function loraParams(m: NormModel, r: number, targets: string): number {
  const h = m.hidden,
    q = m.heads * m.headDim,
    kvd = m.kvHeads * m.headDim,
    f = m.moe ? num(m.moe.expertFfn, m.ffn) : m.ffn;
  let per = r * (h + q + 2 * (h + kvd) + (q + h));
  if (targets === "all") per += r * 3 * (h + f) * (m.moe ? num(m.moe.active, 1) + num(m.moe.shared, 0) : 1);
  return (m.layers * per) / 1e9;
}

export function finetune(s: EngineSettings, gpu: Gpu, model: Model) {
  const m = normModel(model),
    g = gpu,
    T = topology(s),
    G = T.G;
  const method = s.method || "lora",
    prec = s.ftPrec || "mixed",
    O = OPTIM[s.optim as string] || OPTIM.adamw;
  const N = m.params,
    b = Math.max(1, Math.round(s.ftBatch || 1)),
    S = Math.max(16, Math.round(s.ftSeq || 2048)),
    ga = Math.max(1, Math.round(s.gradAccum || 1));
  const lora = method === "full" ? 0 : loraParams(m, Math.max(1, s.loraR || 16), s.loraTargets || "all");
  const trainable = method === "full" ? N : lora;
  const pk: "fp32" | "pure" | "mixed" = prec === "fp32" ? "fp32" : prec === "pure" ? "pure" : "mixed";
  const wB = method === "qlora" ? null : pk === "fp32" ? 4 : 2;
  let weights =
    method === "qlora" ? weightsGiB(m, { b: 4.13, keep16: true }, true) : (N * 1e9 * (method === "full" ? (wB as number) : 2)) / GiB;
  let adapter = method === "full" ? 0 : (lora * 1e9 * 2) / GiB;
  let grads = (trainable * 1e9 * (pk === "fp32" ? 4 : 2)) / GiB;
  let optim = (trainable * 1e9 * O[pk]) / GiB;
  const shard = s.zero || "none";
  if (shard === "zero1" || shard === "zero2" || shard === "zero3") optim /= G;
  if (shard === "zero2" || shard === "zero3") grads /= G;
  if (shard === "zero3") {
    weights /= G;
    adapter /= G;
  }
  const h = m.hidden,
    kvd = m.kvHeads * m.headDim,
    f = m.moe
      ? num(m.moe.expertFfn, m.ffn) * num(m.moe.active, 2) + num(m.moe.sharedFfn, num(m.moe.expertFfn, m.ffn)) * num(m.moe.shared, 0)
      : m.ffn;
  const perTokLayer = 2 * (7 * h + 2 * kvd + 4 * f) + (s.flash === false ? 5 * m.heads * S : 0);
  const tokens = b * S;
  let act = s.ckpt !== false ? (m.layers * tokens * 2 * h + tokens * perTokLayer) / GiB : (m.layers * tokens * perTokLayer) / GiB;
  const logits = s.fused ? (tokens * h * 4) / GiB : (tokens * m.vocab * 6) / GiB;
  const temp = 0.5 + (method === "full" ? Math.min(4, ((trainable * 1e9 * 2) / GiB) * 0.05) : 0.2);
  const frame = 1.5;
  let offRam = 0;
  const offList = s.ftOff || {};
  if (s.ftOffOn) {
    if (offList.optim) {
      offRam += optim * G;
      optim = 0;
    }
    if (offList.grads) {
      offRam += grads * G;
      grads = 0;
    }
    if (offList.weights) {
      offRam += weights * (shard === "zero3" ? G : 1);
      weights = 0;
    }
    if (offList.act) {
      offRam += act * 0.8 * G;
      act *= 0.2;
    }
  }
  const perGpu = weights + adapter + grads + optim + act + logits + temp + frame;
  const usablePerGpu = num(g.memGB, 24) * num(s.usable, 0.9);
  const fits = perGpu <= usablePerGpu + 1e-9;
  // speed
  let Fbase = (method === "full" ? 6 : 4) * m.activeParams * 1e9 + (3 * 4 * attnDim(m) * attnLayers(m) * S) / 2;
  if (s.ckpt !== false) Fbase += 2 * m.activeParams * 1e9;
  let mfu = num(s.ftMfu, method === "full" ? 0.4 : method === "lora" ? 0.35 : 0.28);
  if (s.flash === false) mfu *= 0.8;
  if (s.fused) mfu *= 1.05;
  if (s.pure16 && method === "full") mfu *= 1.03;
  const tf = num(g.fp16, 100) * 1e12;
  const tokS = (G * tf * mfu) / Fbase;
  const useful = s.packing ? 0.98 : s.dynPad ? 0.85 : Math.min(1, num(s.tokPerSample, S) / S);
  const tokPerStep = b * S * ga * G;
  const steps = Math.ceil((num(s.samples, 10000) * num(s.tokPerSample, 1024) * num(s.epochs, 1)) / (tokPerStep * useful));
  const stepCompute = tokPerStep / tokS;
  const pcie = hostLinkGBs(g);
  let stepOff = 0;
  if (s.ftOffOn && offList.optim) stepOff += (trainable * 1e9 * 4) / (pcie * 1e9) + (trainable * 1e9) / 1.5e9 / Math.max(1, G);
  if (s.ftOffOn && offList.weights) stepOff += (ga * 2 * N * 1e9 * 2) / (pcie * 1e9);
  const stepTime = stepCompute + stepOff,
    time = steps * stepTime;
  const totalTokens = num(s.samples, 10000) * num(s.tokPerSample, 1024) * num(s.epochs, 1);
  const price = num(s.price, num(g.priceHr, 0));
  const power = G * num(g.tdpW, g.unified ? 120 : 300) * 0.9 * (1 + num(s.hostOverhead, 0.15));
  const warn: string[] = [];
  if (method === "qlora" && G > 1 && shard === "zero3") warn.push("QLoRA with ZeRO-3 / FSDP needs a recent bitsandbytes + accelerate stack.");
  if (method === "full" && O === OPTIM.paged8) warn.push("Paged optimizers mostly help when GPU memory spikes; states still live in GPU memory between spikes.");
  if (!s.fused && m.vocab >= 150000)
    warn.push(
      "Large vocabulary: the loss logits need " + ((tokens * m.vocab * 6) / GiB).toFixed(1) +
        " GB. Turn on fused kernels (chunked cross-entropy, e.g. Liger) to remove most of it.",
    );
  if (S > m.maxCtx) warn.push("The sequence is longer than the model supports.");
  if (!fits && G > 1 && shard !== "zero3")
    warn.push(
      "With " + (shard === "none" ? "plain data parallel (DDP)" : shard.toUpperCase()) +
        " every GPU keeps a full copy of the weights: choose ZeRO-3 / FSDP to split them across the " + G + " GPUs.",
    );
  return {
    model: m, gpu: g, T, G, method, trainable, lora, weights, adapter, grads, optim,
    act, logits, temp, frame, perGpu, usablePerGpu, ratio: perGpu / usablePerGpu, fits,
    offRam, Fbase, mfu, tokS: tokS * useful, rawTokS: tokS, useful, steps, stepTime, time,
    totalTokens, price, cost: (time / 3600) * (G * price + (power / 1000) * num(s.kwh, 0.12)), power, warn,
  };
}
export type FinetuneResult = ReturnType<typeof finetune>;

// ---------- RAG / agent companion models (embeddings, rerankers, parsers, speech, guardrails...)
export const TASKS: Record<string, { l: string }> = {
  embedding: { l: "Embeddings" },
  reranker: { l: "Reranker" },
  parser: { l: "Document parsing / OCR" },
  asr: { l: "Speech-to-text" },
  tts: { l: "Text-to-speech" },
  guard: { l: "Guardrails" },
  vlm: { l: "Vision" },
  ner: { l: "NER / PII" },
  router: { l: "Router / tool calling" },
};
export const CPREC: Record<string, number> = { fp32: 4, fp16: 2, bf16: 2, int8: 1, fp8: 1, int4: 0.5 };
export const CDEF: Record<string, Record<string, number>> = {
  embedding: { qTok: 64, chunkTok: 512 },
  reranker: { k: 20, pTok: 384, qTok: 64 },
  parser: { pages: 10000, par: 8 },
  asr: { streams: 4 },
  tts: { streams: 4 },
  guard: { checks: 2, tok: 512 },
  vlm: { tok: 1500, out: 300 },
  ner: { tok: 512 },
  router: { tok: 1024, out: 32 },
};

export interface StackContext {
  users?: number;
  qpm?: number;
  searchMs?: number;
  eta?: number;
  cpuTflops?: number;
  ramBw?: number;
  G?: number;
}

export interface CompanionResult {
  c: Companion;
  it: StackItem;
  place: string;
  prec: string;
  W: number;
  metrics: string[];
  latency: number;
  gpuSecPerReq: number;
  share: number;
  cost: number | null;
  warn: string | null;
  perQ?: number;
  mem: number;
  gpuMem: number;
  ram: number;
}

export function companion(c: Companion, it: StackItem, g: Gpu, ctx: StackContext): CompanionResult {
  const api = !!c.api || c.arch === "api";
  const place = api ? "api" : it.place || "gpu";
  const prec = it.prec || c.defaultPrecision || "fp16",
    bytes = CPREC[prec] || 2;
  const N = num(c.params, 0) * 1e9,
    L = num(c.layers, 24),
    d = num(c.hidden, 1024);
  const heads = num(c.heads, 16),
    kvh = num(c.kvHeads, heads),
    hd = num(c.headDim, d / heads);
  const dec = c.arch === "decoder" || c.arch === "vlm" || c.arch === "encoder-decoder";
  const D: Record<string, unknown> = Object.assign({}, CDEF[c.task] || {}, it);
  const W = api ? 0 : c.arch === "pipeline" && !N ? num(c.vramGB, 1.5) : (N * bytes) / GiB;
  const onCpu = place === "cpu";
  const tf = onCpu ? num(ctx.cpuTflops, 8) * 1e12 : num(g.fp16, 100) * 1e12;
  const bw = onCpu ? num(ctx.ramBw, 300) * 1e9 * 0.6 : num(g.bwGBs, 500) * 1e9 * num(ctx.eta, 0.55);
  const mfu = 0.35,
    kvTok = dec ? 2 * L * kvh * hd * 2 : 0,
    wRead = (W * GiB) / bw,
    stepOvh = (1 + 0.012 * L) / 1000;
  function fl(tok: number) {
    return 2 * N * tok + 4 * L * d * tok * tok;
  }
  const over = api ? 0 : dec ? 1.0 : 0.4;
  let act = api ? 0 : dec ? 0.3 : (16384 * d * 2 * 10) / GiB,
    kv = 0;
  const r: CompanionResult = {
    c, it, place, prec, W, metrics: [], latency: 0, gpuSecPerReq: 0, share: 0, cost: null, warn: null, mem: 0, gpuMem: 0, ram: 0,
  };
  const task = c.task;
  if (api) {
    const capi = c.api || {};
    const price = capi.pricePer1kPages != null ? capi.pricePer1kPages : capi.price,
      unit = (capi.priceUnit || "").toLowerCase();
    if (task === "parser" && price != null) {
      r.cost = (num(D.pages, 10000) / 1000) * price;
      r.metrics.push(
        "$" + price + " per 1,000 pages → $" + Math.round(r.cost).toLocaleString("en-US") + " for " + num(D.pages, 10000).toLocaleString("en-US") + " pages",
      );
    } else if (task === "reranker" && price != null) {
      const perQ = unit.indexOf("token") >= 0 ? (price * num(D.k, 20) * (num(D.qTok, 64) + num(D.pTok, 384))) / 1e6 : price / 1000;
      r.perQ = perQ;
      r.latency = 0.25;
      r.metrics.push("$" + price + " " + (capi.priceUnit || "").replace(/^USD /, "") + " → ≈ $" + (perQ * 1000).toFixed(2) + " per 1,000 questions");
      r.metrics.push("≈ 250 ms per call over the network (estimate)");
    } else if (price != null) r.metrics.push("$" + price + " " + (capi.priceUnit || "per 1,000 calls").replace(/^USD /, ""));
    r.metrics.push(capi.dataLeaves === false ? "Can run in your own cloud" : "Documents leave your servers");
    if (capi.selfHost) r.metrics.push("Self-hosting: " + capi.selfHost);
  } else if (task === "embedding" || task === "ner") {
    const q = num(D.qTok, 64),
      ch = num(D.chunkTok, 512);
    r.latency = Math.max(wRead, fl(q) / (tf * mfu)) + 0.002;
    r.gpuSecPerReq = fl(q) / (tf * mfu);
    const tokS = (tf * mfu) / (2 * N + 4 * L * d * ch);
    r.metrics.push((task === "ner" ? "Text of " + q + " tokens" : "Query") + " in " + Math.max(1, Math.round(r.latency * 1000)) + " ms");
    if (task === "embedding") {
      const cps = tokS / ch;
      r.metrics.push("Indexing ≈ " + (cps < 10 ? cps.toFixed(1) : Math.round(cps).toLocaleString("en-US")) + " chunks/s of " + ch + " tokens");
    }
  } else if (task === "reranker" && !dec) {
    const k = num(D.k, 20),
      pair = num(D.qTok, 64) + num(D.pTok, 384);
    r.gpuSecPerReq = (k * fl(pair)) / (tf * mfu);
    r.latency = r.gpuSecPerReq + wRead + 0.003;
    r.metrics.push("Top " + k + " passages in " + Math.round(r.latency * 1000) + " ms");
    r.metrics.push("≈ " + Math.round((tf * mfu) / fl(pair)).toLocaleString("en-US") + " pairs/s");
  } else if (task === "reranker") {
    const k2 = num(D.k, 20),
      pair2 = num(D.qTok, 64) + num(D.pTok, 384);
    r.gpuSecPerReq = (k2 * fl(pair2)) / (tf * 0.4);
    r.latency = r.gpuSecPerReq + wRead + 0.005;
    kv = (Math.min(k2, 32) * pair2 * kvTok) / GiB;
    r.metrics.push("Top " + k2 + " passages in " + Math.round(r.latency * 1000) + " ms (LLM reranker)");
  } else if (task === "parser") {
    const pages = num(D.pages, 10000),
      par = Math.max(1, num(D.par, 8));
    let sp: number;
    if (c.arch === "pipeline" || !dec) {
      sp = num(c.secPerPage, 1.0);
      const hw = c.secPerPageHw || "";
      r.metrics.push(
        "≈ " + sp.toFixed(2) + " s per page" + (hw ? " (published: " + hw.split("(")[0].trim() + ")" : " (estimate)") +
          (onCpu && !/cpu/i.test(hw) ? ", slower on CPU" : ""),
      );
    } else {
      const vis = num(c.visualTokensPerPage, 1200),
        out = num(c.outTokensPerPage, 800);
      kv = (par * (vis + out) * kvTok) / GiB;
      const pre = (par * fl(vis)) / (tf * 0.4),
        step = (W * GiB + par * (vis + out / 2) * kvTok) / bw + stepOvh;
      sp = (pre + out * step) / par;
      r.metrics.push("≈ " + (sp * par).toFixed(1) + " s per page with " + par + " in parallel");
    }
    const pph = 3600 / sp;
    r.metrics.push(
      "≈ " + Math.round(pph).toLocaleString("en-US") + " pages/hour → " + pages.toLocaleString("en-US") + " pages in " +
        (pages / pph < 1 ? Math.round((pages / pph) * 60) + " min" : (pages / pph).toFixed(1) + " h"),
    );
  } else if (task === "asr" || task === "tts") {
    let rtfx: number,
      est = false;
    const streams = Math.max(0, num(D.streams, 4)),
      tokC = (2 * N) / (tf * mfu);
    // autoregressive decoders share one weight read per step across streams: ASR ≈ 4 text tokens + 25 audio tokens per second, TTS ≈ 75 audio tokens per second
    const steps = task === "asr" ? 4 : 75,
      preTok = task === "asr" ? 25 : 0;
    if (task === "asr" && c.rtfxA100) rtfx = c.rtfxA100 * (onCpu ? 0.02 : num(g.fp16, 312) / 312);
    else if (c.rtfx) rtfx = c.rtfx * (onCpu ? 0.05 : 1);
    else if (dec) {
      rtfx = 1 / (steps * (wRead + tokC + stepOvh) + preTok * tokC);
      est = true;
    } else {
      rtfx = onCpu ? 5 : 60;
      est = true;
    }
    r.share = dec && est ? steps * (wRead + stepOvh + streams * tokC) + streams * preTok * tokC : streams / Math.max(0.01, rtfx);
    r.metrics.push("× " + (rtfx >= 10 ? Math.round(rtfx) : rtfx.toFixed(1)) + " real time" + (est ? " (estimate)" : ""));
    r.metrics.push(streams + " live " + (task === "asr" ? "stream" : "voice") + (streams === 1 ? "" : "s") + " use ≈ " + Math.round(r.share * 100) + "% of a GPU");
    if (task === "asr") r.metrics.push("1 hour of audio in ≈ " + Math.max(1, Math.round(3600 / rtfx)) + " s");
    if (r.share > 0.8) r.warn = streams + " live streams need " + Math.round(r.share * 100) + "% of a GPU.";
    act = 0.5;
  } else {
    const tok = num(D.tok, 512),
      outT = task === "guard" ? 5 : num(D.out, 32);
    const one = fl(tok) / (tf * 0.4) + outT * (wRead + stepOvh) + 0.004;
    const checks = task === "guard" ? Math.max(0, num(D.checks, 2)) : 1;
    r.latency = one;
    r.gpuSecPerReq = (checks * fl(tok)) / (tf * 0.4);
    kv = (8 * (tok + outT) * kvTok) / GiB;
    r.metrics.push((task === "guard" ? "Check" : "Call") + " of " + tok + " tokens in " + Math.round(one * 1000) + " ms" + (task === "guard" ? " · " + checks + " per question" : ""));
  }
  r.mem = api ? 0 : W + over + act + kv;
  r.gpuMem = place === "gpu" ? r.mem : 0;
  r.ram = onCpu ? r.mem + 0.5 : 0;
  return r;
}

/** Whole stack: per-model results, GPU / RAM totals, retrieval latency per question and GPU load from questions. */
export function stack(items: StackItem[] | null | undefined, index: Record<string, Companion>, g: Gpu, ctx: StackContext) {
  const rows: CompanionResult[] = [];
  let gpuMem = 0,
    ram = 0,
    cost = 0,
    emb = 0,
    rr = 0,
    guardIn = 0,
    gpuSec = 0,
    share = 0,
    perQ = 0;
  (items || []).forEach((it) => {
    const c = index[it.id];
    if (!c) return;
    const r = companion(c, it, g, ctx);
    rows.push(r);
    gpuMem += r.gpuMem;
    ram += r.ram;
    if (r.cost) cost += r.cost;
    if (r.perQ) perQ += r.perQ;
    if (c.task === "embedding" && !emb && r.place !== "api") emb = r.latency;
    if (c.task === "reranker" && !rr) rr = r.latency;
    if (c.task === "guard" && !guardIn && r.place !== "api") guardIn = r.latency;
    if (r.place === "gpu") {
      gpuSec += r.gpuSecPerReq;
      share += r.share;
    }
  });
  const qps = (num(ctx.users, 1) * num(ctx.qpm, 1)) / 60;
  const load = (gpuSec * qps + share) / Math.max(1, num(ctx.G, 1));
  const search = emb || rr ? num(ctx.searchMs, 15) / 1000 : 0;
  return { rows, gpuMem, ram, cost, perQ, emb, search, rr, guard: guardIn, retrieval: emb + search + rr + guardIn, load, qps };
}
export type StackResult = ReturnType<typeof stack>;
