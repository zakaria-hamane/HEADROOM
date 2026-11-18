"use client";

import * as React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { StatusPill } from "@/components/ui/status";
import { KQ, OPTIM, roundUp, STD_RAM, WQ } from "@/lib/engine";
import { runPlanner } from "@/lib/planner/compute";
import type { PlannerState } from "@/lib/planner/defaults";
import { duration, gb, gpuLabel, money, nf, spd, tm } from "@/lib/planner/format";
import { methodLabel } from "@/lib/planner/report";
import { sanitizeState } from "@/lib/planner/state";

export interface ComparePlanInput {
  id: string;
  name: string;
  state: unknown;
}

type Cell = { text: React.ReactNode; value?: number | null };
type Row = { label: string; cells: Cell[]; better?: "low" | "high" };

export function ComparePlans({ plans }: { plans: ComparePlanInput[] }) {
  const runs = React.useMemo(
    () =>
      plans.map((p) => {
        const state: PlannerState = sanitizeState(p.state);
        return { plan: p, state, results: runPlanner(state) };
      }),
    [plans],
  );

  const rows: Row[] = [];
  const add = (label: string, cell: (x: (typeof runs)[number]) => Cell, better?: "low" | "high") => rows.push({ label, cells: runs.map(cell), better });
  const na: Cell = { text: <span className="text-faint">–</span>, value: null };

  add("Mode", (x) => ({ text: x.state.mode === "ft" ? `Fine-tuning · ${methodLabel(x.state.method)}` : "Inference" }));
  add("Model", (x) => ({ text: (x.results.inf ?? x.results.ft)!.model.name }));
  add("Hardware", (x) => {
    const r = x.results.inf,
      f = x.results.ft;
    const T = r ? r.T : f!.T;
    return { text: `${r ? T.G : f!.G}× ${gpuLabel((r ?? f)!.gpu)}${r && (T.tp > 1 || T.pp > 1) ? ` · ${T.tp} TP × ${T.pp} PP × ${T.dp} DP` : ""}` };
  });
  add("Precision", (x) => (x.state.mode === "ft" ? { text: (OPTIM[x.state.optim] || OPTIM.adamw).l } : { text: `${WQ[x.state.wq]?.l} · ${KQ[x.state.kvq]?.l} KV` }));
  add("Runtime", (x) => (x.results.inf ? { text: x.results.inf.E.l } : na));
  add("Workload", (x) =>
    x.results.inf
      ? { text: `${nf(x.results.inf.users, 0)} users · ${nf(x.results.inf.S, 0)} tokens` }
      : { text: `${nf(x.results.ft!.totalTokens / 1e6, 1)}M training tokens` },
  );
  add(
    "GPU memory",
    (x) => {
      const ratio = (x.results.inf ?? x.results.ft)!.ratio;
      return {
        text: (
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill ratio={ratio} size="sm" /> {nf(ratio * 100, 0)}% of usable
          </span>
        ),
        value: ratio,
      };
    },
    "low",
  );
  add("Speed per user", (x) => (x.results.inf ? { text: `${spd(x.results.inf.speed)} tok/s`, value: x.results.inf.speed } : na), "high");
  add("First word", (x) => (x.results.inf ? { text: `${tm(x.results.inf.ttftK)} (${x.results.inf.k} at once)`, value: x.results.inf.ttftK } : na), "low");
  add("Total output", (x) => (x.results.inf ? { text: `${nf(x.results.inf.thr, 0)} tok/s`, value: x.results.inf.thr } : na), "high");
  add("Training speed", (x) => (x.results.ft ? { text: `${nf(x.results.ft.tokS, 0)} tok/s`, value: x.results.ft.tokS } : na), "high");
  add("Training time", (x) => (x.results.ft ? { text: duration(x.results.ft.time), value: x.results.ft.time } : na), "low");
  add(
    "Cost per hour",
    (x) => {
      const r = x.results.inf,
        f = x.results.ft;
      if (r) return r.price ? { text: money(r.costHr), value: r.costHr } : na;
      return f!.price ? { text: money(f!.G * f!.price), value: f!.G * f!.price } : na;
    },
    "low",
  );
  add("Per 1M output tokens", (x) => (x.results.inf && x.results.inf.price ? { text: money(x.results.inf.perMTok), value: x.results.inf.perMTok } : na), "low");
  add("Training cost", (x) => (x.results.ft && x.results.ft.price ? { text: money(x.results.ft.cost), value: x.results.ft.cost } : na), "low");
  add("Power draw", (x) => {
    const p = (x.results.inf ?? x.results.ft)!.power;
    return { text: `${nf(p / 1000, 1)} kW`, value: p };
  }, "low");
  add("Server", (x) => {
    const r = x.results.inf;
    if (!r) return na;
    return { text: `${r.cores} cores · ${roundUp(r.ramNeed + r.st.ram, STD_RAM)} GB RAM · ${gb(r.used)} on GPUs` };
  });

  const visible = rows.filter((r) => r.cells.some((c) => c !== na));
  const bestIndex = (r: Row): number | null => {
    if (!r.better) return null;
    const vals = r.cells.map((c) => (c.value != null && isFinite(c.value) ? c.value : null));
    if (vals.filter((v) => v != null).length < 2) return null;
    let best: number | null = null;
    vals.forEach((v, i) => {
      if (v == null) return;
      if (best == null || (r.better === "low" ? v < vals[best]! : v > vals[best]!)) best = i;
    });
    return best;
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-card">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr>
            <th scope="col" className="w-44 border-b border-line bg-panel-2 px-4 py-3 text-left font-display text-[13px] tracking-[0.08em] text-muted uppercase">
              Plan
            </th>
            {runs.map((x) => (
              <th key={x.plan.id} scope="col" className="border-b border-line bg-panel-2 px-4 py-3 text-left">
                <Link href={`/plans/${x.plan.id}`} className="text-[14px] font-semibold hover:text-blue">
                  {x.plan.name}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const best = bestIndex(r);
            return (
              <tr key={r.label} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left text-xs font-semibold text-muted">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-4 py-2.5 align-top">
                    <span className={best === i ? "font-semibold" : ""}>{c.text}</span>
                    {best === i ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green/12 px-1.5 py-0.5 text-[10.5px] font-bold text-green">
                        <Trophy className="size-3" /> Best
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        “Best” compares the plans that report a metric. Plans that don&apos;t fit in memory still show their numbers: check the GPU memory row first.
      </p>
    </div>
  );
}
