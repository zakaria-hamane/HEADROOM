"use client";

import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Hint } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { usePlanner } from "@/components/planner/context";
import { NumberField } from "@/components/planner/inputs";
import { runtimeFor } from "@/lib/planner/compute";
import {
  ADV_COST,
  ADV_FT,
  ADV_INF,
  ADVANCED_KEYS,
  DEFAULT_STATE,
  MIN_ONE_KEYS,
  NULLABLE_KEYS,
  POSITIVE_KEYS,
  type AdvancedField,
  type PlannerState,
} from "@/lib/planner/defaults";
import { nf } from "@/lib/planner/format";

function AdvancedGrid({ fields }: { fields: AdvancedField[] }) {
  const { state, gpu, set, fid } = usePlanner();
  const E = runtimeFor(state, gpu);
  const placeholder = (key: keyof PlannerState): string | undefined => {
    if (key === "eta" || key === "mfu") return `${nf(E[key] * 100, 0)} (runtime default)`;
    if (key === "price") return gpu.priceHr ? `${nf(gpu.priceHr, 2)} (typical cloud)` : "not rented in clouds";
    if (key === "ftMfu") return "method default";
    return undefined;
  };
  return (
    <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-3">
      {fields.map((f) => {
        const value = state[f.key] as number | null;
        return (
          <NumberField
            key={f.key}
            id={fid(`adv-${f.key}`)}
            label={f.label}
            hint={f.hint}
            value={value}
            pct={f.kind === "pct"}
            nullable={NULLABLE_KEYS.has(f.key)}
            positive={POSITIVE_KEYS.has(f.key)}
            min={MIN_ONE_KEYS.has(f.key) ? 1 : 0}
            placeholder={placeholder(f.key)}
            onCommit={(v) => {
              if (v === null && !NULLABLE_KEYS.has(f.key)) return;
              set(f.key, v);
            }}
          />
        );
      })}
    </div>
  );
}

export function AdvancedCard() {
  const { state, set, patch } = usePlanner();
  const inf = state.mode === "inf";

  return (
    <details className="group min-w-0 rounded-2xl border border-line bg-panel p-[18px] shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2.5 rounded-lg [&::-webkit-details-marker]:hidden">
        <h2 className="m-0 flex items-center gap-2.5 font-display text-[15px] font-bold tracking-[0.1em] text-muted uppercase">
          <span className="primary-gradient grid size-[22px] place-items-center rounded-[7px] font-sans text-[11px] tracking-normal text-white">6</span>
          Advanced settings
        </h2>
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-faint">
          <span className="hidden sm:inline">efficiency, overheads, cost</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      {inf ? (
        <div>
          <div className="mt-3 grid gap-1.5">
            <span className="text-xs font-semibold text-muted">Matrix maths precision</span>
            <Segmented<PlannerState["prec"]>
              label="Matrix maths precision"
              value={state.prec}
              onChange={(v) => set("prec", v)}
              options={[
                { value: "fp16", label: "16-bit" },
                { value: "eight", label: "8-bit tensor cores (W8A8)" },
                { value: "four", label: "4-bit tensor cores" },
              ]}
            />
          </div>
          <div className="mt-3 grid gap-1.5">
            <span className="text-xs font-semibold text-muted">KV cache layout</span>
            <Segmented<PlannerState["kvMode"]>
              label="KV cache layout"
              value={state.kvMode}
              onChange={(v) => set("kvMode", v)}
              options={[
                { value: "conservative", label: "Conservative (like most calculators)" },
                { value: "exact", label: "Exact layer layout" },
              ]}
            />
            <Hint>Some models (Gemma 4) keep fewer KV heads in their global layers and share K and V. “Exact” counts that, if your runtime supports it.</Hint>
          </div>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Switch className="mt-3" checked={state.swa} onCheckedChange={(v) => set("swa", v)}>
              Sliding-window layers keep only their window
            </Switch>
            <Switch className="mt-3" checked={state.comm} onCheckedChange={(v) => set("comm", v)}>
              Count GPU-to-GPU communication
            </Switch>
            <Switch className="mt-3" checked={state.graphs} onCheckedChange={(v) => set("graphs", v)}>
              CUDA graphs
            </Switch>
            <Switch className="mt-3" checked={state.keep16} onCheckedChange={(v) => set("keep16", v)}>
              Keep embeddings and LM head in 16-bit
            </Switch>
          </div>
          <div className="mt-3">
            <AdvancedGrid fields={ADV_INF} />
          </div>
        </div>
      ) : (
        <div>
          <div className="grid gap-x-4 sm:grid-cols-3">
            {(
              [
                ["flash", "FlashAttention"],
                ["ckpt", "Gradient checkpointing"],
                ["fused", "Fused kernels (chunked loss)"],
                ["packing", "Sequence packing"],
                ["dynPad", "Dynamic padding"],
                ["pure16", "Pure 16-bit kernels"],
              ] as const
            ).map(([k, label]) => (
              <Switch key={k} className="mt-3" checked={state[k]} onCheckedChange={(v) => set(k, v)}>
                {label}
              </Switch>
            ))}
          </div>
          <div className="mt-3">
            <AdvancedGrid fields={ADV_FT} />
          </div>
        </div>
      )}

      <SectionLabel>Cost and power</SectionLabel>
      <AdvancedGrid fields={ADV_COST} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const reset: Partial<PlannerState> = {};
            for (const k of ADVANCED_KEYS) (reset as Record<string, unknown>)[k] = structuredClone(DEFAULT_STATE[k]);
            patch(reset);
            toast("Advanced settings reset");
          }}
        >
          Reset advanced settings
        </Button>
        <Button
          onClick={() => {
            patch({ eta: 0.42, mfu: 0.55, burst: 0.05, comm: false });
            toast("Conservative calibration applied");
          }}
        >
          Use the conservative calibration (42% bandwidth)
        </Button>
      </div>
    </details>
  );
}
