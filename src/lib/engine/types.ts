/** Catalog record shapes (src/data/catalog.json). Optional/nullable fields mirror the published data. */

export interface Model {
  id: string;
  name: string;
  family?: string | null;
  org?: string | null;
  released?: string | null;
  license?: string | null;
  hf?: string | null;
  params: number;
  activeParams?: number | null;
  embedParams?: number | null;
  tied?: boolean | null;
  layers?: number | null;
  hidden?: number | null;
  heads?: number | null;
  kvHeads?: number | null;
  headDim?: number | null;
  ffn?: number | null;
  vocab?: number | null;
  maxCtx?: number | null;
  attention?: string | null;
  swa?: { layers?: number | null; window?: number | null } | null;
  global?: { kvHeads?: number | null; headDim?: number | null; kvShared?: boolean | null } | null;
  mla?: {
    kvLoraRank?: number | null;
    qkRopeHeadDim?: number | null;
    qkNopeHeadDim?: number | null;
    vHeadDim?: number | null;
    qLoraRank?: number | null;
    [key: string]: number | null | undefined;
  } | null;
  moe?: {
    experts?: number | null;
    active?: number | null;
    shared?: number | null;
    expertFfn?: number | null;
    sharedFfn?: number | null;
    denseLayers?: number | null;
    latentDim?: number | null;
  } | null;
  linearLayers?: number | { layers?: number | null; stateLayers?: number | null; stateMB?: number | null; kind?: string | null } | null;
  linearStateMB?: number | null;
  kvSharedLayers?: { sliding?: number | null; full?: number | null } | null;
  kvCompression?: {
    type?: string | null;
    growingElemsPerToken?: number | null;
    windowElemsPerSeq?: number | null;
    documentedBytesPerToken?: number | null;
    [key: string]: unknown;
  } | null;
  multimodal?: boolean | null;
  nativeQuant?: string | null;
  notes?: string | null;
  source?: string | null;
}

export type GpuSegment = "datacenter" | "workstation" | "consumer" | "edge" | "accelerator" | "apple" | "custom";

export interface Gpu {
  id: string;
  name: string;
  vendor?: string | null;
  arch?: string | null;
  segment?: GpuSegment | string | null;
  memGB?: number | null;
  memType?: string | null;
  bwGBs?: number | null;
  fp16?: number | null;
  fp8?: number | null;
  int8?: number | null;
  fp4?: number | null;
  tdpW?: number | null;
  pcieGen?: number | null;
  nvlinkGBs?: number | null;
  linkDomain?: number | null;
  formFactor?: string | null;
  year?: number | null;
  priceHr?: number | null;
  msrpUSD?: number | null;
  unified?: boolean | null;
  source?: string | null;
}

export type CompanionTask = "embedding" | "reranker" | "parser" | "asr" | "tts" | "guard" | "vlm" | "ner" | "router";

export interface CompanionApi {
  price?: number | null;
  pricePer1kPages?: number | null;
  priceUnit?: string | null;
  unit?: string | null;
  selfHost?: string | null;
  dataLeaves?: boolean | null;
  regions?: string | null;
  priceCheckedAt?: string | null;
  plan?: string | null;
  tiers?: unknown;
}

export interface Companion {
  id: string;
  name: string;
  task: CompanionTask | string;
  org?: string | null;
  released?: string | null;
  license?: string | null;
  hf?: string | null;
  arch?: string | null;
  params?: number | null;
  layers?: number | null;
  hidden?: number | null;
  heads?: number | null;
  kvHeads?: number | null;
  headDim?: number | null;
  maxSeq?: number | null;
  dims?: number | null;
  multiVector?: boolean | null;
  multilingual?: boolean | null;
  arabic?: boolean | null;
  french?: boolean | null;
  precisions?: string[] | null;
  defaultPrecision?: string | null;
  servedBy?: string | null;
  visualTokensPerPage?: number | null;
  outTokensPerPage?: number | null;
  rtfxA100?: number | null;
  rtfx?: number | null;
  rtfxGpu?: string | null;
  secPerPage?: number | null;
  secPerPageHw?: string | null;
  vramGB?: number | null;
  cpuOk?: boolean | null;
  api?: CompanionApi | null;
  notes?: string | null;
  source?: string | null;
}

/** One companion model in the RAG/agent stack, with its per-task workload knobs. */
export interface StackItem {
  id: string;
  prec: string;
  place: "gpu" | "cpu" | "api" | string;
  qTok?: number;
  chunkTok?: number;
  k?: number;
  pTok?: number;
  pages?: number;
  par?: number;
  streams?: number;
  checks?: number;
  tok?: number;
  out?: number;
  [key: string]: unknown;
}

export interface Catalog {
  models: Model[];
  gpus: Gpu[];
  companions: Companion[];
}
