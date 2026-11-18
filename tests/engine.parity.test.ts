/**
 * The TypeScript engine must return exactly what the original planner's engine returns.
 * Randomised settings (seeded) are run through both engines for every model in the catalog.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import * as engine from "@/lib/engine";
import type { EngineSettings, Gpu, Model, StackItem } from "@/lib/engine";
import { COMPANIONS, COMPANION_INDEX, GPUS, MODELS } from "@/lib/catalog";

const require = createRequire(import.meta.url);
const original = require("./fixtures/original-engine.cjs");

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function settingsFactory(seed: number) {
  const r = rng(seed);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const bool = () => r() < 0.5;
  const range = (lo: number, hi: number) => lo + r() * (hi - lo);
  return (): EngineSettings => ({
    wq: pick(Object.keys(engine.WQ)),
    kvq: pick(Object.keys(engine.KQ)),
    engine: pick(["auto", ...Object.keys(engine.ENGINES)]),
    hw: r() < 0.7 ? "single" : "cluster",
    n: pick([1, 2, 3, 4, 8, 16]),
    nodes: pick([1, 2, 3, 4]),
    perNode: pick([1, 2, 4, 8]),
    tp: pick([1, 2, 4, 8, 16]),
    pp: pick([1, 2, 4]),
    net: pick(Object.keys(engine.NETS)),
    users: pick([1, 2, 7, 25, 200, 1000, 5000]),
    batch: pick([1, 1, 2, 4]),
    seq: pick([64, 1024, 4096, 8192, 32768, 131072, 1048576]),
    out: pick([1, 128, 512, 2048]),
    prefix: pick([0, 0, 512, 4096]),
    offload: {
      on: r() < 0.35,
      by: pick(["layers", "pct"]),
      layers: pick([0, 4, 20, 60, 200]),
      pct: pick([0, 10, 50, 100]),
      kv: bool(),
      target: pick(["ram", "nvme"]),
      exec: pick(["cpu", "pcie"]),
    },
    host: pick(Object.keys(engine.HOSTS)),
    usable: range(0.5, 0.95),
    eta: r() < 0.5 ? null : range(0.3, 0.8),
    mfu: r() < 0.5 ? null : range(0.2, 0.7),
    burst: range(0, 0.3),
    chunk: pick([128, 512, 2048, 8192]),
    graphs: bool(),
    comm: bool(),
    kvMode: pick(["conservative", "exact"]),
    swa: bool(),
    keep16: bool(),
    prec: pick(["fp16", "eight", "four"]),
    other: pick([0, 0, 2.5, 12]),
    ramEff: range(0.5, 0.9),
    cpuTflops: range(2, 20),
    nvme: range(3, 14),
    price: r() < 0.5 ? null : range(0.5, 10),
    kwh: range(0.05, 0.4),
    util: range(0.2, 0.9),
    powerLoad: range(0.5, 1),
    hostOverhead: range(0, 0.4),
    coresPerGpu: pick([4, 6, 12]),
    appCores: pick([4, 8, 16]),
    offCores: pick([8, 18, 32]),
    appRam: pick([8, 11, 32]),
    method: pick(["full", "lora", "qlora"]),
    ftPrec: pick(["mixed", "pure", "fp32"]),
    optim: pick(Object.keys(engine.OPTIM)),
    loraR: pick([4, 16, 64, 256]),
    loraTargets: pick(["attn", "all"]),
    ftBatch: pick([1, 2, 8]),
    ftSeq: pick([512, 2048, 4096, 32768]),
    gradAccum: pick([1, 4, 16]),
    zero: pick(["none", "zero1", "zero2", "zero3"]),
    samples: pick([100, 20000, 1e6]),
    tokPerSample: pick([128, 1024, 8192]),
    epochs: pick([0.5, 1, 3]),
    ckpt: bool(),
    flash: bool(),
    fused: bool(),
    packing: bool(),
    dynPad: bool(),
    pure16: bool(),
    ftMfu: r() < 0.6 ? null : range(0.2, 0.6),
    ftOffOn: bool(),
    ftOff: { optim: bool(), grads: bool(), weights: bool(), act: bool() },
  });
}

function compare(a: unknown, b: unknown, path: string, out: string[]) {
  if (out.length > 5) return;
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return;
    if (a === b) return;
    const rel = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
    if (!(rel < 1e-12)) out.push(`${path}: ${a} !== ${b}`);
    return;
  }
  // The original returns `undefined` for some falsy flags where the port returns `false`.
  if ((typeof a === "boolean" || a == null) && (typeof b === "boolean" || b == null)) {
    if (!!a !== !!b) out.push(`${path}: ${String(a)} !== ${String(b)}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}.length: ${a.length} !== ${b.length}`);
    a.forEach((x, i) => compare(x, b[i], `${path}[${i}]`, out));
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) compare((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
    return;
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

function expectSame(ported: unknown, reference: unknown, label: string) {
  const diffs: string[] = [];
  compare(ported, reference, label, diffs);
  expect(diffs, diffs.join("\n")).toEqual([]);
}

const SAMPLE_GPUS: Gpu[] = ["l40s", "h100-sxm", "b200", "mi300x", "rtx-4090", "m4-max", "tpu-v6e", "gaudi3", "gb200", "dgx-spark", "t4", "jetson-agx-orin-64gb"]
  .map((id) => GPUS.find((g) => g.id === id))
  .filter((g): g is Gpu => Boolean(g));

describe("engine parity with the original planner", () => {
  it("covers the sample GPUs", () => expect(SAMPLE_GPUS.length).toBe(12));

  it("inference() matches for every model on varied hardware and settings", () => {
    const next = settingsFactory(42);
    let cases = 0;
    for (const m of MODELS) {
      for (const g of SAMPLE_GPUS) {
        const s = next();
        const nOverride = cases % 4 === 0 ? [1, 2, 8][cases % 3] : undefined;
        expectSame(engine.inference(s, g, m, nOverride), original.inference(s, g, m, nOverride), `${m.id}@${g.id}`);
        cases++;
      }
    }
    expect(cases).toBe(MODELS.length * SAMPLE_GPUS.length);
  });

  it("minGpus() and compareAll() match", () => {
    const next = settingsFactory(7);
    for (const m of MODELS.filter((_, i) => i % 6 === 0)) {
      const s = { ...next(), hw: "single" as const };
      for (const g of SAMPLE_GPUS) expectSame(engine.minGpus(s, g, m), original.minGpus(s, g, m), `minGpus ${m.id}@${g.id}`);
    }
    const s = next();
    for (const id of ["llama-3.3-70b", "deepseek-v3", "qwen3-8b"]) {
      const m = MODELS.find((x) => x.id === id) as Model;
      expectSame(engine.compareAll(s, GPUS, m), original.compareAll(s, GPUS, m), `compareAll ${id}`);
    }
  });

  it("finetune() matches for every model", () => {
    const next = settingsFactory(1234);
    for (const m of MODELS) {
      for (const g of SAMPLE_GPUS.slice(0, 6)) {
        const s = next();
        expectSame(engine.finetune(s, g, m), original.finetune(s, g, m), `ft ${m.id}@${g.id}`);
      }
    }
  });

  it("companion stack() matches for every companion model", () => {
    const r = rng(99);
    const precs = ["fp32", "fp16", "bf16", "int8", "fp8", "int4"];
    for (const g of SAMPLE_GPUS.slice(0, 4)) {
      const items: StackItem[] = COMPANIONS.map((c) => ({
        id: c.id,
        prec: precs[Math.floor(r() * precs.length)],
        place: r() < 0.7 ? "gpu" : "cpu",
        ...engine.CDEF[c.task],
        ...(r() < 0.3 ? { pages: 1 + Math.floor(r() * 1e5), streams: Math.floor(r() * 20), k: 1 + Math.floor(r() * 60) } : {}),
      }));
      const ctx = { users: 250, qpm: 1.5, searchMs: 20, eta: 0.55, cpuTflops: 8, ramBw: 538, G: 4 };
      // Skip arch "api" entries without an api block: the original throws on those.
      const safe = items.filter((it) => !(COMPANION_INDEX[it.id].arch === "api" && !COMPANION_INDEX[it.id].api));
      expectSame(engine.stack(safe, COMPANION_INDEX, g, ctx), original.stack(safe, COMPANION_INDEX, g, ctx), `stack@${g.id}`);
    }
  });

  it("exports the same lookup tables", () => {
    for (const key of ["WQ", "KQ", "ENGINES", "NETS", "HOSTS", "OPTIM", "PCIE", "STD_RAM", "TASKS", "CPREC", "CDEF", "GiB"] as const) {
      expectSame((engine as Record<string, unknown>)[key], original[key], key);
    }
  });
});
