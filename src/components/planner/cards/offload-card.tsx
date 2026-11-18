"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePlanner } from "@/components/planner/context";
import { RangeInput } from "@/components/planner/inputs";
import { HOSTS } from "@/lib/engine";
import type { OffloadState } from "@/lib/planner/defaults";
import { gb, nf } from "@/lib/planner/format";
import { cn } from "@/lib/utils";

export function OffloadCard() {
  const { state, model, results, set, fid } = usePlanner();
  const r = results.inf;
  const o = state.offload;
  const layers = model.layers || 1;

  return (
    <Card>
      <CardTitle step={5}>Offloading to RAM or NVMe</CardTitle>
      {r ? (
        <>
          <Switch className="mt-3" checked={o.on} onCheckedChange={(v) => set("offload.on", v)}>
            Move part of the LLM out of GPU memory
          </Switch>
          <div className={cn("transition-opacity", !o.on && "pointer-events-none opacity-45 saturate-50")} aria-disabled={!o.on}>
            <div className="mt-3 grid gap-1.5">
              <span className="text-xs font-semibold text-muted">Target</span>
              <Segmented<OffloadState["target"]>
                label="Offload target"
                value={o.target}
                onChange={(v) => set("offload.target", v)}
                options={[
                  { value: "ram", label: "System RAM" },
                  { value: "nvme", label: "NVMe" },
                ]}
              />
            </div>
            <div className="mt-3 grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-xs font-semibold text-muted">Model weights moved</span>
                <Segmented<OffloadState["by"]>
                  label="Measure weights moved"
                  size="sm"
                  value={o.by}
                  onChange={(v) => set("offload.by", v)}
                  options={[
                    { value: "layers", label: "By layers" },
                    { value: "pct", label: "By percentage" },
                  ]}
                />
              </div>
              <RangeInput
                label="Weights moved"
                min={0}
                max={o.by === "pct" ? 100 : layers}
                value={o.by === "pct" ? o.pct : Math.min(o.layers, layers)}
                onChange={(v) => set(o.by === "pct" ? "offload.pct" : "offload.layers", v)}
              />
              <span className="text-[12.5px] font-semibold tabular-nums">
                {o.by === "pct" ? `${o.pct}% of the weights` : `${Math.min(o.layers, layers)} of ${layers} layers`} · {gb(r.W_off)}
              </span>
            </div>
            <Switch className="mt-3" checked={o.kv} onCheckedChange={(v) => set("offload.kv", v)}>
              KV cache (conversation memory) in RAM
            </Switch>
            <div className="mt-3 grid gap-1.5">
              <span className="text-xs font-semibold text-muted">Who works on what sits in RAM</span>
              <Segmented<OffloadState["exec"]>
                label="Who works on offloaded data"
                value={o.exec}
                onChange={(v) => set("offload.exec", v)}
                options={[
                  { value: "cpu", label: "The CPU, in RAM (llama.cpp style)" },
                  { value: "pcie", label: "The GPU, copied over PCIe" },
                ]}
              />
            </div>
            <div className="mt-3 grid gap-1.5">
              <label htmlFor={fid("host")} className="text-xs font-semibold text-muted">
                Server memory
              </label>
              <Select id={fid("host")} value={state.host} onChange={(e) => set("host", e.target.value)}>
                {Object.entries(HOSTS).map(([k, h]) => (
                  <option key={k} value={k}>
                    {h.l} · ≈ {nf(h.bw, 0)} GB/s
                  </option>
                ))}
              </Select>
            </div>
            {o.on && r.offBytes > 0 ? (
              <p className="mt-2.5 text-xs text-muted">
                {gb(r.offBytes)} lives off the GPU ({gb(r.W_off)} weights{r.KV_off ? `, ${gb(r.KV_off)} KV cache` : ""}). Every new token reads it at ≈ {nf(r.offBw, 0)} GB/s
                {r.cpuExec ? " with the CPU doing that part of the work" : " across PCIe"}, adding {nf(r.tOff * 1000, 1)} ms per token.
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <Switch className="mt-3" checked={state.ftOffOn} onCheckedChange={(v) => set("ftOffOn", v)}>
            Offload to CPU RAM (DeepSpeed ZeRO-Offload style)
          </Switch>
          <div className={cn("mt-1 grid grid-cols-2 gap-x-3 sm:grid-cols-4", !state.ftOffOn && "pointer-events-none opacity-45 saturate-50")}>
            {(
              [
                ["optim", "Optimizer states"],
                ["grads", "Gradients"],
                ["weights", "Model weights"],
                ["act", "Activations"],
              ] as const
            ).map(([k, label]) => (
              <Switch key={k} className="mt-3" checked={state.ftOff[k]} onCheckedChange={(v) => set(`ftOff.${k}`, v)}>
                {label}
              </Switch>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
