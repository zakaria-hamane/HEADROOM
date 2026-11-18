import { GiB, OPTIM, roundUp, STD_RAM } from "@/lib/engine";
import type { FtRun, InfRun } from "./compute";
import type { PlannerState } from "./defaults";
import { fmtP, gb, money, ms, nf, pc, spd, tm } from "./format";

const METHOD_LABEL = { full: "full fine-tuning", lora: "LoRA", qlora: "QLoRA" } as const;

/** Plain-text summary for "Copy summary" (same wording as the original tool). */
export function summaryText(state: PlannerState, inf: InfRun | null, ft: FtRun | null): string {
  if (inf) {
    const r = inf,
      T = r.T,
      ST = r.st;
    return [
      "LLM sizing: " + r.model.name + " · " + r.q.l + " weights · " + r.kq.l + " KV cache · " + r.E.l,
      "Hardware: " + T.G + "× " + r.gpu.name + " (" + T.tp + " TP × " + T.pp + " PP × " + T.dp + " DP)",
      nf(r.users, 0) + " concurrent users · " + nf(r.S, 0) + " tokens of context · answers of " + nf(r.O, 0) + " tokens",
      "GPU memory: " + nf(r.used, 1) + " of " + nf(r.usableRep, 1) + " GB usable per replica (" + nf(r.ratio * 100, 0) + "%) · KV cache " +
        gb(r.kvUserGpu) + " per user" + (r.offBytes ? " · " + gb(r.offBytes) + " offloaded" : ""),
      "Speed: ≈ " + spd(r.speed) + " tokens/s per user · " + nf(r.thr, 0) + " tokens/s total · first word ≈ " + tm(r.ttft1) +
        " (one prompt), " + tm(r.ttftK) + " (" + r.k + " at once)",
      "Cost: " + money(r.costHr) + " per hour · " + money(r.perMTok) + " per 1M tokens at " + pc(r.util) + " utilization · " +
        nf(r.power / 1000, 1) + " kW",
      ST && ST.rows.length
        ? "RAG & agent models: " +
          ST.rows.map((x) => x.c.name + " (" + (x.place === "api" ? "cloud API" : x.place === "cpu" ? "CPU" : gb(x.gpuMem)) + ")").join(", ") +
          (ST.retrieval ? " · retrieval ≈ " + ms(ST.retrieval) + " per question" : "")
        : null,
      "Server: " + r.cores + " CPU cores · " + roundUp(r.ramNeed + (ST ? ST.ram : 0), STD_RAM) + " GB RAM",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const f = ft as FtRun;
  const method = { full: "full", lora: "LoRA r" + state.loraR, qlora: "QLoRA r" + state.loraR }[state.method];
  return [
    "Fine-tuning: " + f.model.name + " · " + method + " · " + (OPTIM[state.optim] || OPTIM.adamw).l,
    "Hardware: " + f.G + "× " + f.gpu.name + " · " + nf(f.perGpu, 1) + " of " + nf(f.usablePerGpu, 1) + " GB per GPU (" + nf(f.ratio * 100, 0) + "%)",
    "Data: " + nf(f.totalTokens / 1e6, 1) + "M tokens · speed ≈ " + nf(f.tokS, 0) + " tok/s · time ≈ " + nf(f.time / 3600, 1) + " h · cost ≈ " + money(f.cost),
  ].join("\n");
}

/** A line of a formula's worked example. `strong` parts are the results. */
export type Part = { text: string; strong?: boolean };
export interface FormulaItem {
  title: string;
  formula: string;
  lines: Part[][];
}

const t = (text: string): Part => ({ text });
const b = (text: string): Part => ({ text, strong: true });

/** "How it is calculated": every formula with the current numbers plugged in. */
export function formulas(state: PlannerState, inf: InfRun | null, ft: FtRun | null): FormulaItem[] {
  const it: FormulaItem[] = [];
  if (inf) {
    const r = inf,
      m = r.model,
      T = r.T,
      n0 = (x: number) => nf(x, 0),
      ST = r.st;
    it.push({
      title: "Model weights",
      formula: "non-embedding parameters × bits ÷ 8 + embeddings × " + (state.keep16 && r.q.keep16 ? "16" : r.q.b) + " bits ÷ 8",
      lines: [[t(fmtP(m.params) + " at " + r.q.b + " bits = "), b(gb(r.W)), t(r.W_off ? " (" + gb(r.W_off) + " off the GPU)" : "")]],
    });
    it.push({
      title: "KV cache per user",
      formula: "layers × KV heads × head size × (K, V) × tokens kept × bytes",
      lines: [
        ...r.kv.parts.map((p) => [
          t(p.layers + " " + p.kind + " layers × " + p.kvh + " × " + p.hd + " × " + p.kv + " × " + n0(p.tokens) + " × " + r.kq.b + " B = " +
            gb(p.bytes / GiB) + (p.rep > 1 ? " × " + p.rep + " copies" : "")),
        ]),
        [t("= "), b(gb(r.kvUserGpu) + " per user")],
      ],
    });
    it.push({
      title: "Runtime",
      formula: "GPUs per replica × (framework + CUDA graphs + multi-GPU buffers) + activations",
      lines: [[t(T.rep + " GPUs: " + gb(r.fw) + " + " + gb(r.graphs) + " + " + gb(r.comm) + " + " + gb(r.act))]],
    });
    it.push({
      title: "GPU memory",
      formula: "weights + runtime + users per replica × KV per user + other models",
      lines: [[
        t(gb(r.W_gpu) + " + " + gb(r.fw + r.graphs + r.comm + r.act) + " + " + n0(r.Br) + " × " + gb(r.kvOff ? 0 : r.kvUserGpu) + " + " + gb(r.other) + " = "),
        b(gb(r.used)),
        t(" of " + gb(r.usableRep) + " usable"),
      ]],
    });
    it.push({
      title: "FLOPs per new token",
      formula: "2 × active parameters + attention over the context",
      lines: [[t("2 × " + fmtP(m.activeParams) + " + attention = "), b(nf(r.Fdec / 1e9, 1) + " GFLOPs")]],
    });
    it.push({
      title: "Time per token",
      formula: "max(bytes read ÷ (bandwidth × efficiency), FLOPs ÷ compute) + communication + offload + runtime overhead",
      lines: [[
        t("max(" + ms(r.tMem) + ", " + ms(r.tComp) + ")" + (r.tComm ? " + " + ms(r.tComm) + " TP" : "") + (r.tP2p ? " + " + ms(r.tP2p) + " PP" : "") +
          (r.tOff ? " + " + ms(r.tOff) + " offload" : "") + " + " + ms(r.tOvh) + " overhead = "),
        b(ms(r.tStep)),
        t(" → "),
        b(spd(r.speed) + " tok/s per user"),
      ]],
    });
    it.push({
      title: "First word",
      formula: "prompt FLOPs ÷ (TP × PP × TFLOPS × MFU), at least one weight read per prefill chunk, × prompts arriving together",
      lines: [[
        t(nf(r.Fpre / 1e12, 1) + " TFLOP ÷ (" + T.tp + " × " + n0(r.tfPer) + " TFLOPS × " + pc(r.mfu) + ") = " + tm(r.tPre) +
          (r.prefComm ? " + " + tm(r.prefComm) + " TP traffic" : "") + " → one prompt "),
        b(tm(r.ttft1)),
        t(", " + r.k + " at once "),
        b(tm(r.ttftK)),
      ]],
    });
    it.push({
      title: "Cost per 1M tokens",
      formula: "(GPU price × GPUs + power × electricity) ÷ (tokens per hour × utilization)",
      lines: [[t(money(r.costHr) + "/h ÷ (" + n0(r.thr * 3600) + " × " + pc(r.util) + ") × 10⁶ = "), b(money(r.perMTok))]],
    });
    if (ST && ST.rows.length)
      it.push({
        title: "RAG & agent models",
        formula:
          "memory = parameters × bytes + runtime + batch buffers (+ KV cache for VLM parsers); encoders: speed = TFLOPS × 35% ÷ (2 × parameters × tokens); " +
          "parsers: image-token prefill + page-text decoding, or published seconds per page; speech: published real-time factor scaled by GPU compute",
        lines: [
          ...ST.rows.map((x) => [t(x.c.name + ": " + (x.place === "api" ? "cloud API" : gb(x.mem)) + (x.latency ? " · " + ms(x.latency) : ""))]),
          [t("retrieval = embed + search + rerank" + (ST.guard ? " + guard" : "") + " = "), b(ms(ST.retrieval))],
        ],
      });
    it.push({
      title: "Server",
      formula: "CPU = cores per GPU × GPUs + app (+ cores for RAM work); RAM = app + max(weights + other models, data in RAM)",
      lines: [[t(r.coresRaw + " → "), b(r.cores + " cores"), t(" · " + gb(r.ramNeed) + " → "), b(r.ram + " GB")]],
    });
  } else if (ft) {
    const f = ft;
    it.push({
      title: "Trainable parameters",
      formula: state.method === "full" ? "all parameters" : "LoRA: layers × rank × (in + out) of each targeted matrix",
      lines: [[b(f.trainable >= 1 ? nf(f.trainable, 2) + "B" : nf(f.trainable * 1000, 1) + "M")]],
    });
    it.push({
      title: "Weights",
      formula: state.method === "qlora" ? "parameters × 4.13 bits (NF4 + double quantization)" : "parameters × bytes per weight",
      lines: [[b(gb(f.weights)), t(" per GPU")]],
    });
    it.push({
      title: "Gradients + optimizer",
      formula: "trainable × (gradient bytes + optimizer bytes), divided by GPUs when sharded",
      lines: [[t(gb(f.grads) + " + " + gb(f.optim) + " per GPU")]],
    });
    it.push({
      title: "Activations",
      formula: state.ckpt ? "checkpointing: layers × tokens × 2 × hidden + one full layer" : "layers × tokens × 2 × (7 × hidden + 2 × KV width + 4 × FFN)",
      lines: [[b(gb(f.act)), t(" + loss logits " + gb(f.logits))]],
    });
    it.push({
      title: "Training speed",
      formula: "GPUs × TFLOPS × MFU ÷ FLOPs per token × useful-token share",
      lines: [[
        t(nf(f.G, 0) + " × " + nf(f.gpu.fp16 || 0, 0) + " × " + pc(f.mfu) + " ÷ " + nf(f.Fbase / 1e9, 0) + " GFLOPs × " + pc(f.useful) + " = "),
        b(nf(f.tokS, 0) + " tok/s"),
      ]],
    });
    it.push({
      title: "Time and cost",
      formula: "steps × step time; cost = hours × (GPUs × price + power × electricity)",
      lines: [[b(nf(f.time / 3600, 1) + " h"), t(" · "), b(money(f.cost))]],
    });
  }
  return it;
}

export function methodLabel(method: PlannerState["method"]): string {
  return METHOD_LABEL[method];
}
