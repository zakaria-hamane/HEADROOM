"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { usePlanner } from "@/components/planner/context";
import { NumberField } from "@/components/planner/inputs";
import { autoEngine, ENGINES, KQ, OPTIM, WQ } from "@/lib/engine";
import type { PlannerState } from "@/lib/planner/defaults";

export function PrecisionCard() {
  const { state, gpu, set, fid } = usePlanner();
  const inf = state.mode === "inf";
  const engineKey = state.engine === "auto" ? autoEngine(state.wq, gpu) : state.engine;
  const engine = ENGINES[engineKey] || ENGINES.vllm;

  return (
    <Card>
      <CardTitle step={2}>{inf ? "Precision & runtime" : "Training method"}</CardTitle>
      {inf ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor={fid("wq")} className="text-xs font-semibold text-muted">
                Weights (inference quantization)
              </label>
              <Select id={fid("wq")} value={state.wq} onChange={(e) => set("wq", e.target.value)}>
                {Object.entries(WQ).map(([k, q]) => (
                  <option key={k} value={k}>
                    {q.l} · {q.b} bits
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor={fid("kvq")} className="text-xs font-semibold text-muted">
                KV cache quantization
              </label>
              <Select id={fid("kvq")} value={state.kvq} onChange={(e) => set("kvq", e.target.value)}>
                {Object.entries(KQ).map(([k, q]) => (
                  <option key={k} value={k}>
                    {q.l}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-3 grid gap-1.5">
            <label htmlFor={fid("engine")} className="text-xs font-semibold text-muted">
              Runtime
            </label>
            <Select id={fid("engine")} value={state.engine} onChange={(e) => set("engine", e.target.value)}>
              <option value="auto">Auto (picks from format and hardware)</option>
              {Object.entries(ENGINES).map(([k, e]) => (
                <option key={k} value={k}>
                  {e.l}
                </option>
              ))}
            </Select>
            <Hint>
              {state.engine === "auto" ? `Auto picked ${engine.l}. ` : ""}
              {engine.paged ? "Paged KV cache." : "Contiguous KV cache."} KV formats: {engine.kv.map((k) => KQ[k]?.l ?? k).join(", ")}.
            </Hint>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 grid gap-1.5">
            <span className="text-xs font-semibold text-muted">Training method</span>
            <Segmented<PlannerState["method"]>
              label="Training method"
              value={state.method}
              onChange={(v) => set("method", v)}
              options={[
                { value: "full", label: "Full fine-tuning" },
                { value: "lora", label: "LoRA" },
                { value: "qlora", label: "QLoRA (4-bit base)" },
              ]}
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor={fid("ftPrec")} className="text-xs font-semibold text-muted">
                Training precision
              </label>
              <Select id={fid("ftPrec")} value={state.ftPrec} onChange={(e) => set("ftPrec", e.target.value)}>
                <option value="mixed">Mixed BF16 + FP32 master weights</option>
                <option value="pure">Pure BF16</option>
                <option value="fp32">FP32</option>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <label htmlFor={fid("optim")} className="text-xs font-semibold text-muted">
                Optimizer
              </label>
              <Select id={fid("optim")} value={state.optim} onChange={(e) => set("optim", e.target.value)}>
                {Object.entries(OPTIM).map(([k, o]) => (
                  <option key={k} value={k}>
                    {o.l}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {state.method !== "full" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumberField id={fid("loraR")} label="LoRA rank" value={state.loraR} integer min={1} onCommit={(v) => v != null && set("loraR", v)} />
              <div className="grid min-w-0 gap-1.5">
                <span className="text-xs font-semibold text-muted">LoRA targets</span>
                <Segmented<PlannerState["loraTargets"]>
                  label="LoRA targets"
                  value={state.loraTargets}
                  onChange={(v) => set("loraTargets", v)}
                  options={[
                    { value: "attn", label: "Attention only" },
                    { value: "all", label: "All linear layers" },
                  ]}
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
