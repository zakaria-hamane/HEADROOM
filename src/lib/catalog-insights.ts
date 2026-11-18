import { GiB, KQ, kvSeq, minGpus, normModel, weightsGiB, WQ, type Gpu, type Model } from "@/lib/engine";
import { GPU_INDEX, GPUS, MODELS } from "@/lib/catalog";
import { defaultState } from "@/lib/planner/defaults";
import { inferenceSettings } from "@/lib/planner/compute";

/** Weights-only memory for a model at a given weight format (GB = GiB). */
export function weightsAt(m: Model, wq: string): number {
  return weightsGiB(normModel(m), WQ[wq], true);
}

export interface ModelRow {
  id: string;
  name: string;
  org: string;
  family: string;
  params: number;
  activeParams: number;
  moe: boolean;
  maxCtx: number;
  attention: string;
  released: string;
  license: string;
  w16: number;
  w8: number;
  w4: number;
}

export function modelRows(): ModelRow[] {
  return MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    org: m.org || "",
    family: m.family || "",
    params: m.params,
    activeParams: m.activeParams || m.params,
    moe: !!m.moe,
    maxCtx: m.maxCtx || 0,
    attention: m.attention || "",
    released: m.released || "",
    license: m.license || "",
    w16: weightsAt(m, "bf16"),
    w8: weightsAt(m, "fp8"),
    w4: weightsAt(m, "awq"),
  }));
}

export interface GpuRow {
  id: string;
  name: string;
  vendor: string;
  segment: string;
  memGB: number;
  memType: string;
  bwGBs: number;
  fp16: number | null;
  fp8: number | null;
  fp4: number | null;
  tdpW: number | null;
  priceHr: number | null;
  year: number | null;
  /** Rough largest model (billions of parameters) whose weights fit on one device at 8-bit / 4-bit, leaving room for runtime and KV cache. */
  fit8: number;
  fit4: number;
}

export function gpuRows(): GpuRow[] {
  return GPUS.map((g) => {
    const room = Math.max(0, (g.memGB || 0) * 0.85 - 2) * GiB; // bytes left after runtime overhead
    return {
      id: g.id,
      name: g.name,
      vendor: g.vendor || "",
      segment: g.segment || "",
      memGB: g.memGB || 0,
      memType: g.memType || "",
      bwGBs: g.bwGBs || 0,
      fp16: g.fp16 ?? null,
      fp8: g.fp8 ?? g.int8 ?? null,
      fp4: g.fp4 ?? null,
      tdpW: g.tdpW ?? null,
      priceHr: g.priceHr ?? null,
      year: g.year ?? null,
      fit8: (room * 0.8) / 1e9, // ~20% kept for KV cache
      fit4: (room * 0.8 * 8) / 4.25 / 1e9,
    };
  });
}

/** KV cache per user at a few context sizes. */
export function kvTable(m: Model): { ctx: number; fp16: number; fp8: number }[] {
  const nm = normModel(m);
  const sizes = [4096, 8192, 32768, 131072, nm.maxCtx].filter((x, i, a) => x <= nm.maxCtx && a.indexOf(x) === i);
  return sizes.map((S) => ({
    ctx: S,
    fp16: kvSeq(nm, S, KQ.fp16.b, false, true, 1).logical / GiB,
    fp8: kvSeq(nm, S, KQ.fp8.b, false, true, 1).logical / GiB,
  }));
}

const POPULAR_GPUS = ["b200", "h200-sxm", "h100-sxm", "mi300x", "a100-sxm-80gb", "l40s", "rtx-pro-6000-server", "rtx-5090", "rtx-4090", "m4-max", "dgx-spark"];

export interface FitRow {
  gpu: Gpu;
  wq: string;
  n1: number | null;
  speed1: number;
  n32: number | null;
  speed32: number;
}

/** Smallest single-server setups for one user and for 32 users at 8K context (FP8 weights where it makes sense). */
export function fitTable(m: Model): FitRow[] {
  return POPULAR_GPUS.map((id) => GPU_INDEX[id])
    .filter((g): g is Gpu => Boolean(g))
    .map((g) => {
      const wq = g.vendor === "Apple" || g.segment === "consumer" ? "q4_k_m" : g.fp8 ? "fp8" : "awq";
      const base = { ...defaultState(), modelId: m.id, gpuId: g.id, wq, kvq: g.vendor === "Apple" || g.segment === "consumer" ? "q8_0" : "fp8", stack: [], seq: 8192, engine: "auto" };
      const s1 = inferenceSettings({ ...base, users: 1 }, 0);
      const s32 = inferenceSettings({ ...base, users: 32 }, 0);
      const a = minGpus(s1, g, m),
        b = minGpus(s32, g, m);
      return { gpu: g, wq, n1: a.n, speed1: a.r.speed, n32: b.n, speed32: b.r.speed };
    });
}
