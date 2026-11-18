import { ENGINES, HOSTS, KQ, NETS, OPTIM, WQ, type Gpu, type Model, type StackItem } from "@/lib/engine";
import { COMPANION_INDEX, GPU_INDEX, GPUS, MODEL_INDEX, MODELS } from "@/lib/catalog";
import { defaultState, DEFAULT_STATE, type PlannerState } from "./defaults";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Copy only primitives and small nested objects from untrusted input (custom model / GPU specs). */
function cleanSpec(input: unknown, depth = 0): Record<string, Json> | null {
  if (!isPlainObject(input)) return null;
  const out: Record<string, Json> = {};
  let n = 0;
  for (const [k, v] of Object.entries(input)) {
    if (++n > 80 || k.length > 40) break;
    if (v === null || typeof v === "boolean") out[k] = v;
    else if (typeof v === "number") out[k] = Number.isFinite(v) ? v : null;
    else if (typeof v === "string") out[k] = v.slice(0, 160);
    else if (isPlainObject(v) && depth < 1) out[k] = cleanSpec(v, depth + 1);
  }
  return out;
}

function cleanStackItem(input: unknown): StackItem | null {
  if (!isPlainObject(input) || typeof input.id !== "string" || !COMPANION_INDEX[input.id]) return null;
  const out: StackItem = {
    id: input.id,
    prec: typeof input.prec === "string" ? input.prec.slice(0, 12) : "fp16",
    place: input.place === "cpu" || input.place === "api" ? input.place : "gpu",
  };
  for (const [k, v] of Object.entries(input)) {
    if (k === "id" || k === "prec" || k === "place") continue;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && k.length <= 20) out[k] = v;
  }
  return out;
}

/**
 * Merge untrusted input (saved plan, setup code, URL) onto the defaults, keeping only known keys whose type
 * matches the default. Same rules as the original tool's loader, plus type checks.
 */
function deepMerge(base: Record<string, unknown>, input: Record<string, unknown>) {
  for (const k of Object.keys(input)) {
    if (!(k in base)) continue;
    const b = base[k],
      v = input[k];
    if (isPlainObject(b) && isPlainObject(v)) deepMerge(b, v);
    else if (b === null) {
      if (v === null || (typeof v === "number" && Number.isFinite(v))) base[k] = v;
    } else if (Array.isArray(b)) {
      if (Array.isArray(v)) base[k] = v;
    } else if (typeof b === typeof v) {
      if (typeof v === "number" && !Number.isFinite(v)) continue;
      base[k] = typeof v === "string" ? v.slice(0, 200) : v;
    }
  }
}

function oneOf<T extends string>(v: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function sanitizeState(input: unknown): PlannerState {
  const s = defaultState();
  if (!isPlainObject(input)) return s;
  const { custom, customGpu, stack, ...rest } = input;
  deepMerge(s as unknown as Record<string, unknown>, rest);
  s.custom = cleanSpec(custom) as Model | null;
  s.customGpu = cleanSpec(customGpu) as Gpu | null;
  if (s.custom && typeof s.custom.name !== "string") s.custom.name = "Custom model";
  if (s.customGpu && typeof s.customGpu.name !== "string") s.customGpu.name = "Custom GPU";
  s.stack = Array.isArray(stack)
    ? stack.slice(0, 24).map(cleanStackItem).filter((x): x is StackItem => x !== null)
    : structuredClone(DEFAULT_STATE.stack);

  if (s.modelId !== "custom" && !MODEL_INDEX[s.modelId]) s.modelId = DEFAULT_STATE.modelId;
  if (s.gpuId !== "custom" && !GPU_INDEX[s.gpuId]) s.gpuId = DEFAULT_STATE.gpuId;
  if (s.modelId === "custom" && !s.custom) s.modelId = DEFAULT_STATE.modelId;
  if (s.gpuId === "custom" && !s.customGpu) s.gpuId = DEFAULT_STATE.gpuId;
  s.mode = oneOf(s.mode, ["inf", "ft"], "inf");
  s.hw = oneOf(s.hw, ["single", "cluster"], "single");
  if (!WQ[s.wq]) s.wq = DEFAULT_STATE.wq;
  if (!KQ[s.kvq]) s.kvq = DEFAULT_STATE.kvq;
  if (s.engine !== "auto" && !ENGINES[s.engine]) s.engine = "auto";
  if (!NETS[s.net]) s.net = DEFAULT_STATE.net;
  if (!HOSTS[s.host]) s.host = DEFAULT_STATE.host;
  if (!OPTIM[s.optim]) s.optim = DEFAULT_STATE.optim;
  s.kvMode = oneOf(s.kvMode, ["conservative", "exact"], "conservative");
  s.prec = oneOf(s.prec, ["fp16", "eight", "four"], "fp16");
  s.method = oneOf(s.method, ["full", "lora", "qlora"], "lora");
  s.ftPrec = oneOf(s.ftPrec, ["mixed", "pure", "fp32"], "mixed");
  s.loraTargets = oneOf(s.loraTargets, ["attn", "all"], "all");
  s.zero = oneOf(s.zero, ["none", "zero1", "zero2", "zero3"], "none");
  s.offload.by = oneOf(s.offload.by, ["layers", "pct"], "layers");
  s.offload.target = oneOf(s.offload.target, ["ram", "nvme"], "ram");
  s.offload.exec = oneOf(s.offload.exec, ["cpu", "pcie"], "cpu");
  s.users = Math.min(100000, Math.max(1, Math.round(s.users) || 1));
  s.seq = Math.min(4194304, Math.max(64, Math.round(s.seq) || 8192));
  return s;
}

/** Setup codes are compatible with the original tool: base64(encodeURIComponent(JSON)). */
export function encodeSetup(state: PlannerState): string {
  const json = JSON.stringify(state);
  if (typeof btoa === "function") return btoa(encodeURIComponent(json));
  return Buffer.from(encodeURIComponent(json), "binary").toString("base64");
}
export function decodeSetup(code: string): PlannerState {
  const raw = code.trim().replace(/^.*#s=/, "");
  const text = typeof atob === "function" ? atob(raw) : Buffer.from(raw, "base64").toString("binary");
  return sanitizeState(JSON.parse(decodeURIComponent(text)));
}

export function currentModel(s: PlannerState): Model {
  return s.modelId === "custom" && s.custom ? s.custom : MODEL_INDEX[s.modelId] || MODELS[0];
}
export function currentGpu(s: PlannerState): Gpu {
  return s.gpuId === "custom" && s.customGpu ? s.customGpu : GPU_INDEX[s.gpuId] || GPUS[0];
}

/** Read a dotted path ("offload.on") from an object. */
export function getPath(o: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o);
}
/** Immutable set of a dotted path. */
export function setPath<T>(o: T, path: string, value: unknown): T {
  const [head, ...tail] = path.split(".");
  const src = (o ?? {}) as Record<string, unknown>;
  return { ...src, [head]: tail.length ? setPath(src[head], tail.join("."), value) : value } as T;
}
