"use client";

import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { usePlanner } from "@/components/planner/context";
import { GPUS } from "@/lib/catalog";
import { compareFinetune, compareInference, gpuMatchesFilter, type CompareFilter, type CompareRowFt, type CompareRowInf } from "@/lib/planner/compute";
import { money, nf, spd, tm } from "@/lib/planner/format";
import { cn } from "@/lib/utils";

type Row = (CompareRowInf | CompareRowFt) & Record<string, unknown>;

const FILTERS: [CompareFilter, string][] = [
  ["all", "All"],
  ["datacenter", "Data center"],
  ["workstation", "Workstation"],
  ["consumer", "Consumer"],
  ["soc", "Apple & SoC"],
];

const INF_COLS = [
  ["g", "GPU"],
  ["n", "GPUs needed"],
  ["speed", "Speed / user"],
  ["ttft", "First word"],
  ["thr", "Total tok/s"],
  ["costHr", "$ / hour"],
  ["perMTok", "$ / 1M tokens"],
  ["power", "Power"],
] as const;
const FT_COLS = [
  ["g", "GPU"],
  ["n", "GPUs needed"],
  ["tokS", "Tokens / s"],
  ["time", "Time"],
  ["cost", "Cost"],
  ["power", "Power"],
] as const;

function cell(key: string, r: Row): React.ReactNode {
  const v = r[key] as number | null;
  switch (key) {
    case "n":
      return v ? <span className="font-semibold text-green">{v}×</span> : <span className="font-semibold text-red">&gt; 16</span>;
    case "speed":
      return spd(v as number);
    case "ttft":
      return tm(v as number);
    case "time":
      return (v as number) < 86400 ? `${nf((v as number) / 3600, 1)} h` : `${nf((v as number) / 86400, 1)} d`;
    case "thr":
    case "tokS":
      return nf(v as number, 0);
    case "power":
      return `${nf((v as number) / 1000, 1)} kW`;
    default:
      return v == null ? "–" : money(v);
  }
}

export function CompareTable() {
  const { state, patch } = usePlanner();
  const inf = state.mode === "inf";
  const [filter, setFilter] = React.useState<CompareFilter>("all");
  const [onlyFits, setOnlyFits] = React.useState(true);
  const [sort, setSort] = React.useState<{ key: string; asc: boolean }>({ key: inf ? "perMTok" : "cost", asc: true });
  const deferred = React.useDeferredValue(state);
  const stale = deferred !== state;

  const all = React.useMemo<Row[]>(() => {
    const list = GPUS.filter((g) => gpuMatchesFilter(g, filter));
    return (deferred.mode === "inf" ? compareInference(deferred, list) : compareFinetune(deferred, list)) as Row[];
  }, [deferred, filter]);

  const cols = inf ? INF_COLS : FT_COLS;
  const sortKey = cols.some((c) => c[0] === sort.key) ? sort.key : inf ? "perMTok" : "cost";
  const rows = React.useMemo(() => {
    const dir = sort.asc ? 1 : -1;
    return (onlyFits ? all.filter((r) => r.n) : all).slice().sort((a, b) => {
      const x = sortKey === "g" ? a.g.name : (a[sortKey] as number | null),
        y = sortKey === "g" ? b.g.name : (b[sortKey] as number | null);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
  }, [all, onlyFits, sortKey, sort.asc]);

  const use = (r: Row) => {
    patch({ gpuId: r.g.id, hw: "single", ...(r.n ? { autoN: false, n: r.n } : {}) });
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    toast.success(`Switched to ${r.g.name}`);
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="GPU segment">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-full border border-line-2 px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:text-fg",
                filter === k && "border-blue bg-blue/14 text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-semibold text-muted">
          <input type="checkbox" className="size-[15px] accent-blue" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} />
          Only setups that fit (up to 16 GPUs)
        </label>
      </div>
      <p className="mb-2.5 text-xs text-muted">
        {inf
          ? "Same model, precision, users and context on every GPU, single server, smallest GPU count that fits. "
          : "Same training setup on every GPU, smallest count that fits. "}
        Prices are typical cloud on-demand rates; pick a row to use that GPU.
      </p>
      <div className={cn("overflow-x-auto rounded-xl border border-line transition-opacity", stale && "opacity-60")}>
        <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
          <thead>
            <tr>
              {cols.map(([k, label]) => {
                const active = k === sortKey;
                return (
                  <th
                    key={k}
                    scope="col"
                    aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"}
                    className={cn("sticky top-0 border-b border-line bg-panel-2 p-0 font-display text-[13px] tracking-[0.06em] uppercase", k === "g" ? "text-left" : "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSort((s) => (s.key === k ? { key: k, asc: !s.asc } : { key: k, asc: k !== "speed" && k !== "thr" && k !== "tokS" }))
                      }
                      className={cn("inline-flex w-full items-center gap-1 px-2.5 py-2.5 whitespace-nowrap", k === "g" ? "justify-start" : "justify-end", active ? "text-blue" : "text-muted hover:text-fg")}
                    >
                      {label}
                      {active ? sort.asc ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="p-4 text-muted">
                  No GPU in this group fits with up to 16 GPUs.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const current = r.g.id === state.gpuId;
              return (
                <tr key={r.g.id} onClick={() => use(r)} className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-panel-3", current && "bg-blue/12")}>
                  {cols.map(([k]) =>
                    k === "g" ? (
                      <td key={k} className="px-2.5 py-2 text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            use(r);
                          }}
                          className="rounded text-left font-semibold hover:text-blue"
                          aria-label={`Use ${r.g.name}`}
                        >
                          {r.g.name}
                        </button>
                        <small className="block text-[11px] font-normal text-faint">
                          {nf(r.g.memGB || 0, 0)} GB · {nf(r.g.bwGBs || 0, 0)} GB/s{current ? " · current" : ""}
                        </small>
                      </td>
                    ) : (
                      <td key={k} className="px-2.5 py-2 text-right font-mono whitespace-nowrap tabular-nums">
                        {cell(k, r)}
                      </td>
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
