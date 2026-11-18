import {
  autoEngine,
  ENGINES,
  finetune,
  HOSTS,
  inference,
  minGpus,
  single,
  stack,
  type EngineSettings,
  type FinetuneResult,
  type Gpu,
  type InferenceResult,
  type Model,
  type StackContext,
  type StackResult,
} from "@/lib/engine";
import { COMPANION_INDEX, GPUS } from "@/lib/catalog";
import type { PlanSummary } from "@/db/schema";
import { GPU_COUNTS, USERS_STEPS, type PlannerState } from "./defaults";
import { currentGpu, currentModel } from "./state";

export type InfRun = InferenceResult & { fitN: number | null; st: StackResult };
export type FtRun = FinetuneResult & { fitN: number | null };
export type PlannerResults = { mode: "inf"; inf: InfRun; ft: null } | { mode: "ft"; inf: null; ft: FtRun };

export function runtimeFor(state: PlannerState, gpu: Gpu) {
  return ENGINES[state.engine === "auto" ? autoEngine(state.wq, gpu) : state.engine] || ENGINES.vllm;
}

function stackCtx(state: PlannerState, gpu: Gpu, G?: number): StackContext {
  const E = runtimeFor(state, gpu);
  return {
    users: state.users,
    qpm: state.qpm,
    searchMs: state.searchMs,
    eta: state.eta != null ? state.eta : E.eta,
    cpuTflops: state.cpuTflops,
    ramBw: (HOSTS[state.host] || ({} as { bw?: number })).bw,
    G: G || 1,
  };
}

/** Engine input for inference: the RAG stack's GPU memory is added to "other". */
export function inferenceSettings(state: PlannerState, stackGpuMem: number): EngineSettings {
  const { stack: _stack, ...rest } = state;
  void _stack;
  return { ...rest, offload: state.offload, other: (+state.other || 0) + stackGpuMem };
}

export function runInference(state: PlannerState): InfRun {
  const m = currentModel(state),
    g = currentGpu(state);
  const first = stack(state.stack, COMPANION_INDEX, g, stackCtx(state, g, 1));
  const s = inferenceSettings(state, first.gpuMem);
  let R: InferenceResult, fitN: number | null;
  if (s.hw === "single" && state.autoN) {
    const x = minGpus(s, g, m);
    s.n = x.n || 16;
    R = x.r && x.n ? x.r : inference(s, g, m);
    fitN = x.n;
  } else {
    R = inference(s, g, m);
    fitN = s.hw === "single" ? minGpus(s, g, m).n : null;
  }
  const st = stack(state.stack, COMPANION_INDEX, g, stackCtx(state, g, R.T.G));
  return Object.assign(R, { fitN, st });
}

function fitFinetune(s: EngineSettings, g: Gpu, m: Model): { best: FinetuneResult | null; result: FinetuneResult } {
  let best: FinetuneResult | null = null;
  (single(g) ? [1] : [...GPU_COUNTS]).some((n) => {
    const r = finetune(Object.assign({}, s, { n }), g, m);
    if (r.fits) {
      best = r;
      return true;
    }
    return false;
  });
  return { best, result: best || finetune(Object.assign({}, s, { n: 16 }), g, m) };
}

export function runFinetune(state: PlannerState): FtRun {
  const m = currentModel(state),
    g = currentGpu(state);
  const s: EngineSettings = { ...state };
  if (s.hw === "single" && state.autoN) {
    const { best, result } = fitFinetune(s, g, m);
    return Object.assign(result, { fitN: best ? (best as FinetuneResult).G : null });
  }
  return Object.assign(finetune(s, g, m), { fitN: null });
}

export function runPlanner(state: PlannerState): PlannerResults {
  return state.mode === "ft" ? { mode: "ft", inf: null, ft: runFinetune(state) } : { mode: "inf", inf: runInference(state), ft: null };
}

// ---------- compare every GPU (smallest single-server count that fits)

export type CompareFilter = "all" | "datacenter" | "workstation" | "consumer" | "soc";

export function gpuMatchesFilter(g: Gpu, f: CompareFilter | string): boolean {
  if (f === "all") return true;
  if (f === "soc") return g.segment === "apple" || g.segment === "edge" || !!g.unified;
  if (f === "other") return g.segment === "accelerator";
  return g.segment === f;
}

export interface CompareRowInf {
  g: Gpu;
  n: number | null;
  speed: number;
  ttft: number;
  thr: number;
  costHr: number | null;
  perMTok: number | null;
  power: number;
}
export interface CompareRowFt {
  g: Gpu;
  n: number | null;
  tokS: number;
  time: number;
  cost: number | null;
  power: number;
}

export function compareInference(state: PlannerState, gpus: Gpu[] = GPUS): CompareRowInf[] {
  const m = currentModel(state),
    g0 = currentGpu(state);
  const st = stack(state.stack, COMPANION_INDEX, g0, stackCtx(state, g0, 1));
  const s = inferenceSettings(state, st.gpuMem);
  s.hw = "single";
  return gpus.map((g) => {
    const x = minGpus(s, g, m),
      r = x.r;
    return {
      g, n: x.n, speed: r.speed, ttft: r.ttftK, thr: r.thr,
      costHr: x.n && r.price ? r.costHr : null,
      perMTok: x.n && r.price ? r.perMTok : null,
      power: r.power,
    };
  });
}

export function compareFinetune(state: PlannerState, gpus: Gpu[] = GPUS): CompareRowFt[] {
  const m = currentModel(state);
  const s: EngineSettings = { ...state, hw: "single" };
  return gpus.map((g) => {
    const { best, result } = fitFinetune(s, g, m);
    return {
      g, n: best ? (best as FinetuneResult).G : null, tokS: result.tokS, time: result.time,
      cost: best && result.price ? result.cost : null, power: result.power,
    };
  });
}

// ---------- capacity sweep: the same hardware under a growing number of users

export interface ScalingPoint {
  users: number;
  speed: number;
  ttft: number;
  ratio: number;
  fits: boolean;
  thr: number;
}

export function scalingSweep(state: PlannerState, gpus: number): ScalingPoint[] {
  const m = currentModel(state),
    g = currentGpu(state);
  const st = stack(state.stack, COMPANION_INDEX, g, stackCtx(state, g, 1));
  const base = inferenceSettings(state, st.gpuMem);
  const steps = [...new Set([...USERS_STEPS, state.users])].sort((a, b) => a - b);
  return steps.map((users) => {
    const s = { ...base, users };
    const r = state.hw === "single" ? inference(s, g, m, gpus) : inference(s, g, m);
    return { users, speed: r.speed, ttft: r.ttftK, ratio: r.ratio, fits: r.fits, thr: r.thr };
  });
}

/** Largest integer u in [1, hi] with ok(u), assuming ok is true then false as u grows. 0 if ok(1) is false. */
function lastTrue(ok: (u: number) => boolean, hi = 100000): number {
  if (!ok(1)) return 0;
  if (ok(hi)) return hi;
  let lo = 1,
    h = hi;
  while (h - lo > 1) {
    const mid = Math.floor((lo + h) / 2);
    if (ok(mid)) lo = mid;
    else h = mid;
  }
  return lo;
}

/** On fixed hardware: how many concurrent users fit in memory, and how many still get reading-speed answers. */
export function capacityLimits(state: PlannerState, gpus: number, readTps: number): { maxFit: number; maxReadable: number; max: number } {
  const m = currentModel(state),
    g = currentGpu(state);
  const st = stack(state.stack, COMPANION_INDEX, g, stackCtx(state, g, 1));
  const base = inferenceSettings(state, st.gpuMem);
  const run = (users: number) => (state.hw === "single" ? inference({ ...base, users }, g, m, gpus) : inference({ ...base, users }, g, m));
  const max = 100000;
  return {
    maxFit: lastTrue((u) => run(u).fits, max),
    maxReadable: lastTrue((u) => {
      const r = run(u);
      return r.fits && r.speed >= readTps;
    }, max),
    max,
  };
}

// ---------- headline numbers stored with each saved plan

export function planSummary(state: PlannerState): PlanSummary {
  const model = currentModel(state),
    gpu = currentGpu(state);
  if (state.mode === "ft") {
    const f = runFinetune(state);
    return {
      mode: "ft", model: model.name, gpu: gpu.name, gpus: f.G, fits: f.fits, ratio: f.ratio,
      usedGB: f.perGpu, usableGB: f.usablePerGpu, method: state.method, tokS: f.tokS,
      hours: f.time / 3600, cost: f.price ? f.cost : null,
    };
  }
  const r = runInference(state);
  return {
    mode: "inf", model: model.name, gpu: gpu.name, gpus: r.T.G, fits: r.fits, ratio: r.ratio,
    usedGB: r.used, usableGB: r.usableRep, users: r.users, context: r.S, speed: r.speed, ttft: r.ttftK,
    throughput: r.thr, costHr: r.price ? r.costHr : null, perMTok: r.price && isFinite(r.perMTok) ? r.perMTok : null,
  };
}

export function defaultPlanName(state: PlannerState): string {
  const m = currentModel(state),
    g = currentGpu(state);
  const gpu = (g.name || "GPU").replace(/^(NVIDIA|AMD|Intel|Apple|Google) /, "").replace(/\s*\(.*\)$/, "");
  return `${m.name} on ${gpu}${state.mode === "ft" ? " · fine-tune" : ""}`;
}
