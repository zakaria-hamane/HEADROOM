"use client";

import type { ReactNode } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { usePlanner } from "@/components/planner/context";
import { NumberField, NumberInput, StepSlider } from "@/components/planner/inputs";
import { SEQ_STEPS, USERS_STEPS, type PlannerState } from "@/lib/planner/defaults";
import { gb, nf } from "@/lib/planner/format";
import { cn } from "@/lib/utils";

function Chip({ children, hot }: { children: ReactNode; hot?: boolean }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-[0.03em]", hot ? "border-cyan/45 text-cyan" : "border-line-2 text-muted")}>
      {children}
    </span>
  );
}

export function WorkloadCard() {
  const { state, results, set, fid } = usePlanner();
  const r = results.inf,
    f = results.ft;

  return (
    <Card>
      <CardTitle step={4}>{r ? "Workload" : "Dataset & batch"}</CardTitle>
      {r ? (
        <>
          <div className="mt-3 grid gap-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <label htmlFor={fid("users")} className="text-xs font-semibold text-muted">
                Concurrent users
              </label>
              <NumberInput
                id={fid("users")}
                className="w-[120px] text-right font-mono font-bold"
                value={state.users}
                integer
                min={1}
                max={100000}
                onCommit={(v) => v != null && v >= 1 && set("users", v)}
              />
            </div>
            <StepSlider steps={USERS_STEPS} value={state.users} onChange={(v) => set("users", v)} label="Concurrent users" />
          </div>
          <div className="mt-3 grid gap-1.5">
            <div className="flex items-center justify-between gap-2.5">
              <label htmlFor={fid("seq")} className="text-xs font-semibold text-muted">
                Context per user (prompt + answer)
              </label>
              <NumberInput
                id={fid("seq")}
                className="w-[120px] text-right font-mono font-bold"
                value={state.seq}
                integer
                min={64}
                max={4194304}
                onCommit={(v) => v != null && v >= 64 && set("seq", v)}
              />
            </div>
            <StepSlider steps={SEQ_STEPS} value={state.seq} onChange={(v) => set("seq", v)} label="Context per user" />
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Chip>Prompt ≈ {nf(r.P, 0)} tokens</Chip>
              <Chip>Answer {nf(r.O, 0)}</Chip>
              {r.pre ? <Chip>Cached prefix {nf(r.pre, 0)}</Chip> : null}
              <Chip hot>KV cache ≈ {gb(r.kvOff ? r.kvUserRam : r.kvUserGpu)} per user</Chip>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField id={fid("out")} label="Answer length (tokens)" value={state.out} integer min={1} onCommit={(v) => v != null && v >= 1 && set("out", v)} />
            <NumberField id={fid("prefix")} label="Shared prefix, cached (tokens)" value={state.prefix} integer onCommit={(v) => v != null && set("prefix", v)} />
            <NumberField id={fid("batch")} label="Sequences per user" value={state.batch} integer min={1} max={64} onCommit={(v) => v != null && v >= 1 && set("batch", v)} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField id={fid("samples")} label="Training samples" value={state.samples} integer min={1} onCommit={(v) => v != null && v >= 1 && set("samples", v)} />
            <NumberField id={fid("tokPerSample")} label="Tokens per sample" value={state.tokPerSample} integer min={1} onCommit={(v) => v != null && v >= 1 && set("tokPerSample", v)} />
            <NumberField id={fid("epochs")} label="Epochs" value={state.epochs} positive onCommit={(v) => v != null && v > 0 && set("epochs", v)} />
          </div>
          {f ? (
            <p className="mt-2 text-xs text-muted">
              Total: {nf(f.totalTokens / 1e6, 1)} million tokens · {nf(f.steps, 0)} optimizer steps
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField id={fid("ftBatch")} label="Micro-batch per GPU" value={state.ftBatch} integer min={1} onCommit={(v) => v != null && v >= 1 && set("ftBatch", v)} />
            <NumberField id={fid("ftSeq")} label="Sequence length" value={state.ftSeq} integer min={64} onCommit={(v) => v != null && v >= 1 && set("ftSeq", v)} />
            <NumberField id={fid("gradAccum")} label="Gradient accumulation" value={state.gradAccum} integer min={1} onCommit={(v) => v != null && v >= 1 && set("gradAccum", v)} />
            <div className="grid min-w-0 content-start gap-1.5">
              <label htmlFor={fid("zero")} className="text-xs font-semibold text-muted">
                Sharding across GPUs
              </label>
              <Select id={fid("zero")} value={state.zero} onChange={(e) => set("zero", e.target.value as PlannerState["zero"])}>
                <option value="none">None (DDP)</option>
                <option value="zero1">ZeRO-1 (optimizer)</option>
                <option value="zero2">ZeRO-2 (+ gradients)</option>
                <option value="zero3">ZeRO-3 / FSDP (+ weights)</option>
              </Select>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
