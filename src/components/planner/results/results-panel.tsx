"use client";

import * as React from "react";
import { OctagonX, TriangleAlert } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { memoryStatus } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/status";
import { usePlanner } from "@/components/planner/context";
import { TaskTag } from "@/components/planner/cards/stack-card";
import { Tweened } from "@/components/planner/results/tweened";
import { OPTIM, roundUp, STD_RAM } from "@/lib/engine";
import type { FtRun, InfRun } from "@/lib/planner/compute";
import { READ_TPS, type PlannerState } from "@/lib/planner/defaults";
import { duration, gb, gpuLabel, money, ms, nf, pc, spd, tm } from "@/lib/planner/format";
import { methodLabel } from "@/lib/planner/report";
import { cn } from "@/lib/utils";

// ---------- building blocks

function Headline({
  ratio,
  used,
  ofText,
  detail,
  pills,
  note,
}: {
  ratio: number;
  used: number;
  ofText: string;
  detail: string;
  pills: { text: string; warm?: boolean }[];
  note: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill ratio={ratio} />
        <span className="text-xs text-muted">of usable VRAM</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <Tweened value={ratio * 100} format={(v) => `${nf(v, 0)}%`} className="text-[52px] leading-none font-semibold tracking-[-0.03em]" />
        <div className="pb-1 text-right text-[13px] text-muted">
          <Tweened value={used} format={(v) => nf(v, 1)} className="text-xl font-semibold text-fg" /> GB
          <span className="block">{ofText}</span>
        </div>
      </div>
      <Meter ratio={ratio} />
      <p className="mt-2 text-xs text-muted">{detail}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {pills.map((p) => (
          <span
            key={p.text}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs tabular-nums",
              p.warm ? "border-orange/40 bg-orange/10 text-fg" : "border-line bg-panel-3",
            )}
          >
            {p.text}
          </span>
        ))}
      </div>
      {note ? <p className="mt-1.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

/** Ratio against the usable limit: the fill carries severity, the track is a lighter step of the same color. */
function Meter({ ratio }: { ratio: number }) {
  const st = memoryStatus(ratio);
  const w = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div
      role="meter"
      aria-label="GPU memory used, share of usable memory"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={`${Math.round(ratio * 100)}% of usable memory, ${st.label}`}
      className="mt-3 h-2.5 overflow-hidden rounded-full"
      style={{ background: `color-mix(in srgb, ${st.color} 18%, var(--track))` }}
    >
      <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-out" style={{ width: `${w}%`, background: st.color }} />
    </div>
  );
}

function StatTile({ label, value, format, sub }: { label: string; value: number; format: (v: number) => string; sub: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-xl border border-line bg-panel-2 px-3.5 py-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <Tweened value={value} format={format} className="truncate text-[22px] leading-tight font-semibold tracking-[-0.02em]" />
      <span className="text-xs text-faint">{sub}</span>
    </div>
  );
}

export interface BreakdownPart {
  name: string;
  value: number;
  color: string;
}

/** Thin segmented bar + a swatch list carrying every name and amount. */
function Breakdown({ title, parts, usable, total }: { title: string; parts: BreakdownPart[]; usable: number; total: number }) {
  const shown = parts.filter((p) => p.value > 0.005);
  const used = shown.reduce((a, p) => a + p.value, 0);
  const free = Math.max(0, usable - used),
    reserve = Math.max(0, total - Math.max(usable, used)),
    over = Math.max(0, used - usable);
  const cap = Math.max(total, used);
  const pct = (x: number) => `${(x / cap) * 100}%`;
  const label = shown.map((p) => `${p.name} ${gb(p.value)}`).join(", ");
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <div className="relative">
        <div role="img" aria-label={`${title}: ${label}; ${over > 0 ? `${gb(over)} over the usable limit` : `${gb(free)} free`}`} className="flex h-2 gap-[2px] overflow-hidden rounded-full">
          {shown.map((p) => (
            <i key={p.name} title={`${p.name}: ${gb(p.value)}`} className="block h-full min-w-[2px] transition-[width] duration-500" style={{ width: pct(p.value), background: p.color }} />
          ))}
          {free > 0 ? <i title={`Free (usable): ${gb(free)}`} className="block h-full bg-track" style={{ width: pct(free) }} /> : null}
          {reserve > 0 ? (
            <i
              title={`Headroom kept: ${gb(reserve)}`}
              className="block h-full"
              style={{ width: pct(reserve), background: "repeating-linear-gradient(135deg, var(--line-2) 0 3px, transparent 3px 6px)" }}
            />
          ) : null}
        </div>
        {/* usable limit marker */}
        <span aria-hidden className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-fg/70" style={{ left: `calc(${pct(usable)} - 1px)` }} />
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.name} className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <i className="size-2.5 flex-none rounded-[3px]" style={{ background: p.color }} />
              <span className="truncate">{p.name}</span>
            </span>
            <b className="font-semibold tabular-nums">{gb(p.value)}</b>
          </li>
        ))}
        <li className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted">
            <i className="size-2.5 flex-none rounded-[3px] bg-track ring-1 ring-line-2" />
            {over > 0 ? "Over the usable limit" : "Free (usable)"}
          </span>
          <b className={cn("font-semibold tabular-nums", over > 0 && "text-red")}>{gb(over > 0 ? over : free)}</b>
        </li>
        <li className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted">
            <i className="size-2.5 flex-none rounded-[3px]" style={{ background: "repeating-linear-gradient(135deg, var(--line-2) 0 2px, transparent 2px 4px)" }} />
            Headroom kept
          </span>
          <b className="font-semibold tabular-nums">{gb(total - usable)}</b>
        </li>
      </ul>
    </div>
  );
}

function MiniGrid({ items, cols = 4 }: { items: [string, string][]; cols?: 3 | 4 }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", cols === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 rounded-xl border border-line bg-panel-2 px-3 py-2">
          <span className="block text-[11px] font-semibold text-muted">{k}</span>
          <b className="block truncate text-[15px] font-semibold" title={v}>
            {v}
          </b>
        </div>
      ))}
    </div>
  );
}

function Warnings({ bad, items }: { bad?: string | null; items: string[] }) {
  if (!bad && !items.length) return null;
  return (
    <ul className="mt-4 grid gap-1.5" aria-label="Warnings">
      {bad ? (
        <li className="flex gap-2 rounded-[10px] border border-red/45 bg-red/10 px-2.5 py-2 text-xs font-semibold">
          <OctagonX className="mt-px size-4 flex-none text-status-critical" aria-hidden />
          <span>{bad}</span>
        </li>
      ) : null}
      {items.map((w) => (
        <li key={w} className="flex gap-2 rounded-[10px] border border-amber/35 bg-amber/10 px-2.5 py-2 text-xs">
          <TriangleAlert className="mt-px size-4 flex-none text-amber" aria-hidden />
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}

function boundText(r: InfRun): React.ReactNode {
  const traffic = r.tComm + r.tP2p > 0.0005 && r.bound !== "comm" ? `, of which ${ms(r.tComm + r.tP2p)} is GPU-to-GPU traffic over ${r.link.kind}` : "";
  const why: Record<string, React.ReactNode> = {
    bandwidth: (
      <>
        Limit: <b className="text-fg">GPU memory bandwidth</b>: every step reads {gb(r.bytesW)} of weights{r.model.moe ? ` (${pc(r.touched)} of experts touched)` : ""} and {gb(r.bytesKV)} of KV cache.
      </>
    ),
    compute: (
      <>
        Limit: <b className="text-fg">GPU compute</b>.
      </>
    ),
    ram: (
      <>
        Limit: <b className="text-fg">system RAM bandwidth</b>: {gb(r.offBytes)} read from RAM per token.
      </>
    ),
    cpu: (
      <>
        Limit: <b className="text-fg">CPU compute</b> on the work kept in RAM.
      </>
    ),
    pcie: (
      <>
        Limit: <b className="text-fg">PCIe</b>: {gb(r.offBytes)} copied to the GPU per token.
      </>
    ),
    nvme: (
      <>
        Limit: <b className="text-fg">NVMe reads</b>.
      </>
    ),
    comm: (
      <>
        Limit: <b className="text-fg">GPU-to-GPU communication</b> over {r.link.kind}.
      </>
    ),
  };
  return (
    <>
      Each new token takes <b className="text-fg">{ms(r.tStep)}</b>
      {traffic}. {why[r.bound]}
    </>
  );
}

function ReadingBar({ speed }: { speed: number }) {
  const max = Math.max(40, speed * 1.15);
  const verdict =
    speed >= 7
      ? { text: "Answers appear faster than people read", color: "var(--status-good)" }
      : speed >= 4.5
        ? { text: "Answers appear at about reading speed", color: "var(--status-warning)" }
        : { text: "Answers appear slower than people read", color: "var(--status-critical)" };
  return (
    <div className="mt-4">
      <div className="relative h-2.5 rounded-full bg-track">
        <div className="absolute inset-y-0 left-0 rounded-full bg-series-1 transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, (speed / max) * 100)}%` }} />
        <div
          className="absolute -inset-y-1.5 rounded-[3px] bg-fg/55"
          style={{ left: `${(5 / max) * 100}%`, width: `${Math.max(0.6, (1 / max) * 100)}%` }}
          title={`People read ≈ ${READ_TPS} tokens/s`}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 font-semibold">
          <i className="size-2 rounded-full" style={{ background: verdict.color }} aria-hidden />
          {verdict.text}
        </span>
        <span className="text-muted">▮ people read ≈ 5–6 tokens/s · 1 token ≈ ¾ word</span>
      </div>
    </div>
  );
}

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)", "var(--series-7)"];

// ---------- inference

function InferenceResults({ r, state }: { r: InfRun; state: PlannerState }) {
  const g = r.gpu,
    T = r.T,
    ST = r.st;
  const pills = [
    { text: r.kvOff ? `LLM ${gb(r.shared)} on GPU · KV cache in RAM` : `LLM ${gb(r.shared)} shared + ${gb(r.kvUserGpu * (1 - r.pre / r.S))} per user` },
    ...(r.offBytes > 0 ? [{ text: `Offloaded to ${state.offload.target === "nvme" ? "NVMe" : "RAM"}: ${gb(r.offBytes)}`, warm: true }] : []),
  ];
  const companionsGpu = ST.rows.reduce((a, x) => a + x.gpuMem, 0);
  const parts: BreakdownPart[] = [
    { name: "Model weights", value: r.W_gpu, color: SERIES[0] },
    { name: "KV cache", value: r.KV_gpu, color: SERIES[1] },
    { name: "Runtime, CUDA graphs & buffers", value: r.fw + r.graphs + r.comm, color: SERIES[2] },
    { name: "Activations", value: r.act, color: SERIES[3] },
    { name: "RAG & agent models", value: companionsGpu, color: SERIES[4] },
    { name: "Other GPU memory", value: +state.other || 0, color: SERIES[5] },
  ];
  const warn = [...r.warn];
  ST.rows.forEach((x) => {
    if (x.warn) warn.push(`${x.c.name}: ${x.warn}`);
    if ((x.c.task === "embedding" || x.c.task === "reranker") && x.c.multilingual === false)
      warn.push(`${x.c.name} is English-only: check it covers the languages of your documents (French, Arabic…).`);
    if (x.place === "api" && x.c.api && x.c.api.dataLeaves !== false) warn.push(`${x.c.name} is a cloud service: documents are sent outside your servers.`);
  });
  const ragParts: string[] = [];
  if (ST.emb) ragParts.push(`embed ${ms(ST.emb)}`);
  if (ST.search) ragParts.push(`search ${ms(ST.search)}`);
  if (ST.rr) ragParts.push(`rerank ${ms(ST.rr)}`);
  if (ST.guard) ragParts.push(`guard ${ms(ST.guard)}`);

  return (
    <>
      <Headline
        ratio={r.ratio}
        used={r.used}
        ofText={`of ${nf(r.usableRep, 1)} GB usable${T.dp > 1 ? " per replica" : ""}`}
        detail={`${nf(r.totalRep, 0)} GB on ${T.rep}× ${gpuLabel(g)}${T.dp > 1 ? ` per replica · ${T.dp} replicas (${T.G} GPUs)` : ""} · ${nf(r.usablePerGpu, 1)} GB usable per GPU · runtime: ${r.E.l}`}
        pills={pills}
        note={r.kvOff ? "User count limited by RAM, not GPU memory." : `Room for ≈ ${nf(r.maxSeqs, 0)} conversations of ${nf(r.S, 0)} tokens on ${T.dp > 1 ? `the ${T.G} GPUs` : "these GPUs"}.`}
      />
      <div className={cn("mt-4 grid grid-cols-2 gap-2.5", !r.fits && "opacity-55")}>
        <StatTile label="Speed per user" value={r.speed} format={(v) => `${spd(v)} tok/s`} sub={`${nf(1000 / r.speed, 0)} ms per token`} />
        <StatTile
          label="First word"
          value={r.ttftK}
          format={tm}
          sub={r.k > 1 ? `${r.k} prompts at once · ${tm(r.ttft1)} for one` : `prompt of ${nf(r.P - r.pre, 0)} new tokens`}
        />
        <StatTile label="Total output" value={r.thr} format={(v) => `${nf(v, 0)} tok/s`} sub={`${nf(r.seqs, 0)} answers at once`} />
        <StatTile label="Compute used" value={r.computeTF} format={(v) => `${nf(v, 0)} TFLOPS`} sub={`${pc(r.share, r.share < 0.1 ? 1 : 0)} of ${nf(r.totalTF, 0)} TFLOPS`} />
      </div>
      <div className={cn(!r.fits && "opacity-55")}>
        <ReadingBar speed={r.speed} />
        <p className="mt-3 text-[12.5px] text-muted">{boundText(r)}</p>
      </div>
      <Breakdown title={`Where the GPU memory goes${T.dp > 1 ? " (one replica)" : ""}`} parts={parts} usable={r.usableRep} total={r.totalRep} />

      {ST.rows.length ? (
        <div>
          <SectionLabel>RAG &amp; agent stack</SectionLabel>
          <ul className="grid gap-2">
            {ST.rows.map((x, i) => (
              <li key={`${x.c.id}-${i}`} className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-dashed border-line pb-2 text-[12.5px]">
                <TaskTag task={x.c.task} api={x.place === "api"} />
                <b className="truncate">{x.c.name}</b>
                <span className="font-mono">{x.place === "api" ? "API" : x.place === "cpu" ? `${gb(x.ram)} RAM` : gb(x.gpuMem)}</span>
                <span className="col-span-3 text-xs text-muted">{x.metrics.join(" · ")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 font-mono text-xs leading-relaxed text-muted">
            {ragParts.length ? (
              <>
                Question → first word: {ragParts.join(" + ")} + LLM {tm(r.ttft1)} = <b className="text-fg">{tm(r.ttft1 + ST.retrieval)}</b> for one prompt,{" "}
                <b className="text-fg">{tm(r.ttftK + ST.retrieval)}</b> with {r.k} at once
                <br />
              </>
            ) : null}
            At {nf(r.users, 0)} users × {nf(+state.qpm || 0, 1)} question/min ({nf(ST.qps, 1)}/s), these models use ≈{" "}
            <b className="text-fg">{pc(ST.load, ST.load < 0.1 ? 1 : 0)}</b> of the GPUs’ compute
            {ST.cost ? (
              <>
                {" "}
                · cloud parsing ≈ <b className="text-fg">{money(ST.cost)}</b>
              </>
            ) : null}
            {ST.perQ ? (
              <>
                {" "}
                · cloud reranking ≈ <b className="text-fg">{money(ST.perQ * ST.qps * 3600)}</b> per hour at this load
              </>
            ) : null}
            .
          </p>
        </div>
      ) : null}

      <SectionLabel>Cost and energy</SectionLabel>
      <MiniGrid
        items={[
          ["GPU cost per hour", r.price ? money(r.costHr) : "add a price"],
          ["Per 1M output tokens", r.price ? money(r.perMTok) : "–"],
          ["Energy per 1M tokens", isFinite(r.kwhPerMTok) ? `${nf(r.kwhPerMTok, r.kwhPerMTok < 10 ? 2 : 0)} kWh` : "–"],
          ["Power draw", `${nf(r.power / 1000, 1)} kW`],
        ]}
      />
      <SectionLabel>Server</SectionLabel>
      <MiniGrid
        cols={3}
        items={[
          ["GPUs", `${T.G}× ${gpuLabel(g)}`],
          ["CPU", `${r.cores} cores`],
          ["RAM", `${roundUp(r.ramNeed + ST.ram, STD_RAM)} GB`],
        ]}
      />
      <Warnings
        bad={!r.fits ? `Does not fit: ${gb(r.used)} needed, ${gb(r.usableRep)} usable. Add GPUs, lower the precision, shorten the context, cut users or offload.` : null}
        items={warn}
      />
    </>
  );
}

// ---------- fine-tuning

function FinetuneResults({ f, state }: { f: FtRun; state: PlannerState }) {
  const g = f.gpu;
  const cap = g.memGB || 24;
  const trainable = f.trainable >= 1 ? `${nf(f.trainable, 2)}B` : `${nf(f.trainable * 1000, 1)}M`;
  return (
    <>
      <Headline
        ratio={f.ratio}
        used={f.perGpu}
        ofText={`of ${nf(f.usablePerGpu, 1)} GB usable per GPU`}
        detail={`${f.G}× ${gpuLabel(g)} · ${methodLabel(state.method)} · ${(OPTIM[state.optim] || OPTIM.adamw).l}`}
        pills={[
          { text: `Trainable: ${trainable} parameters (${pc(f.trainable / f.model.params, 2)})` },
          ...(f.offRam > 0 ? [{ text: `Offloaded to RAM: ${gb(f.offRam)}`, warm: true }] : []),
        ]}
        note={`Effective batch: ${nf(state.ftBatch * state.gradAccum * f.G, 0)} sequences of ${nf(state.ftSeq, 0)} tokens per optimizer step.`}
      />
      <div className={cn("mt-4 grid grid-cols-2 gap-2.5", !f.fits && "opacity-55")}>
        <StatTile label="Training speed" value={f.tokS} format={(v) => `${nf(v, 0)} tok/s`} sub={`${nf(f.tokS / f.G, 0)} per GPU · MFU ${pc(f.mfu)}`} />
        <StatTile label="Training time" value={f.time} format={duration} sub={`${nf(f.steps, 0)} steps · ${nf(f.stepTime, 2)} s each`} />
        <StatTile
          label="Cost"
          value={f.cost}
          format={(v) => (f.price ? money(v) : "–")}
          sub={f.price ? `${f.G} GPU${f.G > 1 ? "s" : ""} at $${nf(f.price, 2)}/h + power` : "add a GPU price"}
        />
        <StatTile
          label="Compute per token"
          value={f.Fbase / 1e9}
          format={(v) => `${nf(v, 0)} GFLOPs`}
          sub={`${state.method === "full" ? "6N" : "4N"}${state.ckpt ? " + 2N recompute" : ""} + attention`}
        />
      </div>
      <p className="mt-3 text-[12.5px] text-muted">
        Memory per GPU = weights + gradients + optimizer states + activations{state.method !== "full" ? " + adapters" : ""}.{" "}
        {f.fits ? null : (
          <>
            <b className="text-fg">Does not fit</b>: try ZeRO-3, LoRA / QLoRA, gradient checkpointing, a smaller micro-batch or offloading.
          </>
        )}
      </p>
      <Breakdown
        title="Where the GPU memory goes (per GPU)"
        parts={[
          { name: "Model weights", value: f.weights, color: SERIES[0] },
          { name: "LoRA adapters", value: f.adapter, color: SERIES[1] },
          { name: "Gradients", value: f.grads, color: SERIES[2] },
          { name: "Optimizer states", value: f.optim, color: SERIES[3] },
          { name: "Activations", value: f.act, color: SERIES[4] },
          { name: "Loss logits", value: f.logits, color: SERIES[5] },
          { name: "Temp buffers + framework", value: f.temp + f.frame, color: SERIES[6] },
        ]}
        usable={f.usablePerGpu}
        total={cap}
      />
      <SectionLabel>Cost and energy</SectionLabel>
      <MiniGrid
        items={[
          ["GPU cost per hour", f.price ? money(f.G * f.price) : "add a price"],
          ["Cost per 1M tokens", f.price ? money(f.cost / (f.totalTokens / 1e6)) : "–"],
          ["Energy", `${nf(((f.power / 1000) * f.time) / 3600, 0)} kWh`],
          ["Power draw", `${nf(f.power / 1000, 1)} kW`],
        ]}
      />
      <SectionLabel>Server</SectionLabel>
      <MiniGrid
        cols={3}
        items={[
          ["GPUs", `${f.G}× ${gpuLabel(g)}`],
          ["CPU", `${Math.max(16, state.coresPerGpu * f.G + state.appCores)} cores`],
          ["RAM", `${Math.max(64, Math.pow(2, Math.ceil(Math.log2(f.offRam + f.model.params * 2.2 + 32))))} GB`],
        ]}
      />
      <Warnings bad={!f.fits ? `Does not fit: ${gb(f.perGpu)} needed per GPU, ${gb(f.usablePerGpu)} usable.` : null} items={f.warn} />
    </>
  );
}

/** Short, debounced announcement for screen readers (the panel itself is not a live region). */
function LiveSummary({ text }: { text: string }) {
  const [said, setSaid] = React.useState(text);
  React.useEffect(() => {
    const t = setTimeout(() => setSaid(text), 900);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <p className="sr-only" aria-live="polite">
      {said}
    </p>
  );
}

export function ResultsPanel() {
  const { state, results, resultsRef } = usePlanner();
  const summary = results.inf
    ? `${memoryStatus(results.inf.ratio).label}: ${nf(results.inf.ratio * 100, 0)}% of usable memory on ${results.inf.T.G} GPUs, ${spd(results.inf.speed)} tokens per second per user.`
    : `${memoryStatus(results.ft.ratio).label}: ${nf(results.ft.ratio * 100, 0)}% of usable memory per GPU on ${results.ft.G} GPUs, about ${duration(results.ft.time)} of training.`;
  return (
    <Card ref={resultsRef} className="scroll-mt-20 p-5" aria-label="Results">
      <LiveSummary text={summary} />
      {results.inf ? <InferenceResults r={results.inf} state={state} /> : <FinetuneResults f={results.ft} state={state} />}
    </Card>
  );
}
