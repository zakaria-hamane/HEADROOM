import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { COMPANION_INDEX } from "@/lib/catalog";
import { defaultState, PRESETS, presetStack, type PlannerState } from "@/lib/planner/defaults";
import { compareInference, planSummary, runFinetune, runInference, scalingSweep } from "@/lib/planner/compute";
import { currentGpu, currentModel, decodeSetup, encodeSetup, sanitizeState, setPath } from "@/lib/planner/state";

const require = createRequire(import.meta.url);
const original = require("./fixtures/original-engine.cjs");

/** The original UI's runInf(), driven by the original engine. */
function originalRunInf(state: PlannerState) {
  const g = currentGpu(state),
    m = currentModel(state);
  const E = original.ENGINES[state.engine === "auto" ? original.autoEngine(state.wq, g) : state.engine] || original.ENGINES.vllm;
  const ctx = (G?: number) => ({
    users: state.users, qpm: state.qpm, searchMs: state.searchMs, eta: state.eta != null ? state.eta : E.eta,
    cpuTflops: state.cpuTflops, ramBw: (original.HOSTS[state.host] || {}).bw, G: G || 1,
  });
  let ST = original.stack(state.stack, COMPANION_INDEX, g, ctx(1));
  const s = JSON.parse(JSON.stringify(state));
  s.offload = state.offload;
  s.other = (+state.other || 0) + ST.gpuMem;
  delete s.stack;
  let R;
  if (s.hw === "single" && s.autoN) {
    const x = original.minGpus(s, g, m);
    s.n = x.n || 16;
    R = x.r && x.n ? x.r : original.inference(s, g, m);
    R.fitN = x.n;
  } else {
    R = original.inference(s, g, m);
    R.fitN = s.hw === "single" ? original.minGpus(s, g, m).n : null;
  }
  ST = original.stack(state.stack, COMPANION_INDEX, g, ctx(R.T.G));
  R.st = ST;
  return R;
}

describe("planner state", () => {
  it("defaults match the original tool", () => {
    const s = defaultState();
    expect(s.modelId).toBe("gemma-4-31b");
    expect(s.gpuId).toBe("l40s");
    expect(s.stack.map((x) => x.id)).toEqual(["bge-m3", "bge-reranker-v2-m3", "granite-docling-258m"]);
    expect(s.users).toBe(200);
    expect(s.seq).toBe(8192);
  });

  it("sanitizes untrusted input", () => {
    const s = sanitizeState({
      users: "lots",
      seq: 16384,
      wq: "not-a-format",
      modelId: "nope",
      gpuId: "h100-sxm",
      offload: { on: true, target: "tape", layers: 4 },
      evil: { __proto__: { polluted: true } },
      stack: [{ id: "bge-m3", prec: "int8", place: "cpu", qTok: 32, junk: "x" }, { id: "unknown" }, 5],
      custom: { name: "Mine", params: 7, layers: Infinity, nested: { deep: { deeper: 1 } } },
    });
    expect(s.users).toBe(200);
    expect(s.seq).toBe(16384);
    expect(s.wq).toBe("int8");
    expect(s.modelId).toBe("gemma-4-31b");
    expect(s.gpuId).toBe("h100-sxm");
    expect(s.offload).toMatchObject({ on: true, target: "ram", layers: 4 });
    expect(s.stack).toEqual([{ id: "bge-m3", prec: "int8", place: "cpu", qTok: 32 }]);
    expect(s.custom).toMatchObject({ name: "Mine", params: 7, layers: null });
    expect((s.custom as unknown as { nested: unknown }).nested).toEqual({}); // objects nested deeper than one level are dropped
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("round-trips setup codes and reads codes from the original tool", () => {
    const s = setPath(defaultState(), "offload.on", true);
    expect(decodeSetup(encodeSetup(s))).toEqual(s);
    const legacy = btoa(encodeURIComponent(JSON.stringify({ modelId: "llama-3.3-70b", gpuId: "h100-sxm", users: 50, mode: "ft" })));
    const d = decodeSetup(legacy);
    expect([d.modelId, d.gpuId, d.users, d.mode]).toEqual(["llama-3.3-70b", "h100-sxm", 50, "ft"]);
    expect(decodeSetup(`https://example.com/#s=${legacy}`).modelId).toBe("llama-3.3-70b");
  });
});

describe("planner runs", () => {
  const variants: Partial<PlannerState>[] = [
    {},
    { modelId: "llama-3.3-70b", gpuId: "h100-sxm", wq: "fp8", users: 64, seq: 32768 },
    { modelId: "deepseek-v3", gpuId: "b200", wq: "fp8", hw: "cluster", nodes: 2, perNode: 8, tp: 8, pp: 2 },
    { modelId: "qwen3-8b", gpuId: "rtx-4090", wq: "q4_k_m", kvq: "q8_0", users: 4, autoN: false, n: 2 },
    { modelId: "gpt-oss-120b", gpuId: "m4-max", wq: "mxfp4", users: 1, stack: presetStack(PRESETS[4].ids) },
    { modelId: "llama-3.1-405b", gpuId: "l40s", offload: { on: true, by: "pct", layers: 0, pct: 40, kv: true, target: "ram", exec: "cpu" } },
  ];

  it("runInference() matches the original runInf()", () => {
    for (const v of variants) {
      const state = { ...defaultState(), ...v };
      const mine = runInference(state);
      const ref = originalRunInf(state);
      expect(mine.fitN).toBe(ref.fitN);
      expect(mine.T).toEqual(ref.T);
      for (const k of ["used", "usableRep", "speed", "thr", "ttft1", "ttftK", "costHr", "perMTok", "maxSeqs", "cores", "ram"] as const)
        expect(mine[k], k).toBe(ref[k]);
      expect(mine.warn).toEqual(ref.warn);
      expect(mine.st.gpuMem).toBe(ref.st.gpuMem);
      expect(mine.st.load).toBe(ref.st.load);
    }
  });

  it("auto GPU count picks the smallest count that fits", () => {
    const r = runInference({ ...defaultState(), modelId: "llama-3.3-70b", gpuId: "h100-sxm", wq: "bf16", users: 16 });
    expect(r.fits).toBe(true);
    expect(r.fitN).toBe(r.T.G);
    expect([2, 4, 8, 16]).toContain(r.T.G);
  });

  it("fine-tuning, comparison, sweep and summaries produce finite numbers", () => {
    const ft = runFinetune({ ...defaultState(), mode: "ft", modelId: "qwen3-8b", gpuId: "rtx-4090", method: "qlora" });
    expect(ft.fits).toBe(true);
    expect(ft.time).toBeGreaterThan(0);
    const rows = compareInference(defaultState());
    expect(rows.length).toBeGreaterThan(80);
    expect(rows.some((r) => r.n === 1)).toBe(true);
    const sweep = scalingSweep(defaultState(), 4);
    expect(sweep[0].speed).toBeGreaterThan(sweep[sweep.length - 1].speed);
    const sum = planSummary(defaultState());
    expect(sum).toMatchObject({ mode: "inf", model: "Gemma 4 31B", fits: true });
    expect(planSummary({ ...defaultState(), mode: "ft" })).toMatchObject({ mode: "ft" });
  });
});

describe("templates", () => {
  it("every template fits in memory with its own settings", async () => {
    const { TEMPLATES, templateState } = await import("@/lib/planner/templates");
    for (const t of TEMPLATES) {
      const s = templateState(t.id)!;
      const fits = s.mode === "ft" ? runFinetune(s).fits : runInference(s).fits;
      expect(fits, t.id).toBe(true);
    }
  });
});
