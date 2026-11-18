"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { GpuRow, ModelRow } from "@/lib/catalog-insights";
import { fmtP, nf } from "@/lib/planner/format";
import { cn } from "@/lib/utils";

type Col<T> = { key: keyof T & string; label: string; align?: "left" | "right"; render: (r: T) => React.ReactNode; sortValue?: (r: T) => number | string };

function useSort<T>(rows: T[], initial: { key: string; asc: boolean }, cols: Col<T>[]) {
  const [sort, setSort] = React.useState(initial);
  const sorted = React.useMemo(() => {
    const col = cols.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = col.sortValue ?? ((r: T) => r[col.key] as unknown as number | string);
    const dir = sort.asc ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const x = val(a),
        y = val(b);
      if (x == null || x === "") return 1;
      if (y == null || y === "") return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
  }, [rows, sort, cols]);
  const toggle = (key: string) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === "name" }));
  return { sorted, sort, toggle };
}

function Table<T extends { id: string }>({ cols, rows, sort, onSort, href }: { cols: Col<T>[]; rows: T[]; sort: { key: string; asc: boolean }; onSort: (k: string) => void; href: (r: T) => string }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel shadow-card">
      <table className="w-full min-w-[880px] border-collapse text-[13px]">
        <thead>
          <tr>
            {cols.map((c) => {
              const active = c.key === sort.key;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"} className="sticky top-0 border-b border-line bg-panel-2 p-0">
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className={cn(
                      "flex w-full items-center gap-1 px-3 py-2.5 font-display text-[13px] tracking-[0.06em] whitespace-nowrap uppercase",
                      c.align === "right" ? "justify-end" : "justify-start",
                      active ? "text-blue" : "text-muted hover:text-fg",
                    )}
                  >
                    {c.label}
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
              <td colSpan={cols.length} className="p-6 text-center text-muted">
                Nothing matches. Try another search or filter.
              </td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr key={r.id} onClick={() => router.push(href(r))} className="cursor-pointer border-b border-line last:border-0 hover:bg-panel-3">
              {cols.map((c) => (
                <td key={c.key} className={cn("px-3 py-2.5 whitespace-nowrap", c.align === "right" ? "text-right font-mono tabular-nums" : "text-left")}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterChips<K extends string>({ value, onChange, options, label }: { value: K; onChange: (k: K) => void; options: [K, string][]; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cn("rounded-full border border-line-2 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-fg", value === k && "border-blue bg-blue/14 text-fg")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-56 flex-1 sm:max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 pl-9" />
    </div>
  );
}

const gbFmt = (x: number) => `${nf(x, x >= 100 ? 0 : 1)} GB`;

const MODEL_COLS: Col<ModelRow>[] = [
  {
    key: "name",
    label: "Model",
    render: (r) => (
      <Link href={`/models/${r.id}`} onClick={(e) => e.stopPropagation()} className="block font-semibold hover:text-blue">
        {r.name}
        <small className="block text-[11px] font-normal text-faint">
          {r.org} · {r.family}
        </small>
      </Link>
    ),
  },
  { key: "params", label: "Parameters", align: "right", render: (r) => (r.moe ? `${fmtP(r.params)} · ${fmtP(r.activeParams)} act.` : fmtP(r.params)) },
  { key: "maxCtx", label: "Context", align: "right", render: (r) => `${nf(r.maxCtx / 1024, 0)}K` },
  { key: "attention", label: "Attention", render: (r) => <span className="text-muted">{r.attention}</span> },
  { key: "w16", label: "BF16 weights", align: "right", render: (r) => gbFmt(r.w16) },
  { key: "w8", label: "FP8 weights", align: "right", render: (r) => gbFmt(r.w8) },
  { key: "w4", label: "4-bit weights", align: "right", render: (r) => gbFmt(r.w4) },
  { key: "released", label: "Released", align: "right", render: (r) => r.released },
];

type SizeFilter = "all" | "s" | "m" | "l" | "xl" | "moe";

export function ModelsTable({ rows }: { rows: ModelRow[] }) {
  const [q, setQ] = React.useState("");
  const [f, setF] = React.useState<SizeFilter>("all");
  const term = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    const p = r.params;
    const ok = f === "all" || (f === "s" && p <= 10) || (f === "m" && p > 10 && p <= 40) || (f === "l" && p > 40 && p <= 150) || (f === "xl" && p > 150) || (f === "moe" && r.moe);
    return ok && (!term || [r.name, r.org, r.family, r.id, r.license].join(" ").toLowerCase().includes(term));
  });
  const { sorted, sort, toggle } = useSort(filtered, { key: "released", asc: false }, MODEL_COLS);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search models, makers, families…" />
        <FilterChips<SizeFilter>
          label="Model size"
          value={f}
          onChange={setF}
          options={[
            ["all", "All"],
            ["s", "≤ 10B"],
            ["m", "10–40B"],
            ["l", "40–150B"],
            ["xl", "150B+"],
            ["moe", "MoE"],
          ]}
        />
        <span className="ml-auto text-xs text-muted">{sorted.length} models</span>
      </div>
      <Table cols={MODEL_COLS} rows={sorted} sort={sort} onSort={toggle} href={(r) => `/models/${r.id}`} />
      <p className="mt-2 text-xs text-faint">Weights only, with embeddings kept in 16-bit for quantized formats. KV cache and runtime come on top: open a model for the full picture.</p>
    </div>
  );
}

const SEG: Record<string, string> = { datacenter: "Data center", workstation: "Workstation", consumer: "Consumer", apple: "Apple", edge: "Edge", accelerator: "Accelerator" };

const GPU_COLS: Col<GpuRow>[] = [
  {
    key: "name",
    label: "GPU",
    render: (r) => (
      <span className="block font-semibold">
        {r.name}
        <small className="block text-[11px] font-normal text-faint">
          {r.vendor} · {SEG[r.segment] || r.segment}
          {r.year ? ` · ${r.year}` : ""}
        </small>
      </span>
    ),
  },
  { key: "memGB", label: "Memory", align: "right", render: (r) => `${nf(r.memGB, 0)} GB` },
  { key: "bwGBs", label: "Bandwidth", align: "right", render: (r) => `${nf(r.bwGBs, 0)} GB/s` },
  { key: "fp16", label: "16-bit TFLOPS", align: "right", render: (r) => (r.fp16 ? nf(r.fp16, 0) : "–"), sortValue: (r) => r.fp16 ?? -1 },
  { key: "fp8", label: "8-bit", align: "right", render: (r) => (r.fp8 ? nf(r.fp8, 0) : "–"), sortValue: (r) => r.fp8 ?? -1 },
  { key: "fp4", label: "4-bit", align: "right", render: (r) => (r.fp4 ? nf(r.fp4, 0) : "–"), sortValue: (r) => r.fp4 ?? -1 },
  { key: "fit8", label: "Fits at 8-bit", align: "right", render: (r) => `≈ ${fmtP(r.fit8)}` },
  { key: "tdpW", label: "Power", align: "right", render: (r) => (r.tdpW ? `${nf(r.tdpW, 0)} W` : "–"), sortValue: (r) => r.tdpW ?? -1 },
  { key: "priceHr", label: "$ / hour", align: "right", render: (r) => (r.priceHr ? `$${nf(r.priceHr, 2)}` : "–"), sortValue: (r) => r.priceHr ?? Infinity },
];

type SegFilter = "all" | "datacenter" | "workstation" | "consumer" | "soc" | "accelerator";

export function GpusTable({ rows }: { rows: GpuRow[] }) {
  const [q, setQ] = React.useState("");
  const [f, setF] = React.useState<SegFilter>("all");
  const term = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    const ok = f === "all" || (f === "soc" ? r.segment === "apple" || r.segment === "edge" : r.segment === f);
    return ok && (!term || [r.name, r.vendor, r.id, r.memType].join(" ").toLowerCase().includes(term));
  });
  const { sorted, sort, toggle } = useSort(filtered, { key: "memGB", asc: false }, GPU_COLS);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search H100, 4090, MI300X, M4…" />
        <FilterChips<SegFilter>
          label="Segment"
          value={f}
          onChange={setF}
          options={[
            ["all", "All"],
            ["datacenter", "Data center"],
            ["workstation", "Workstation"],
            ["consumer", "Consumer"],
            ["soc", "Apple & edge"],
            ["accelerator", "TPU / Gaudi"],
          ]}
        />
        <span className="ml-auto text-xs text-muted">{sorted.length} GPUs</span>
      </div>
      <Table cols={GPU_COLS} rows={sorted} sort={sort} onSort={toggle} href={(r) => `/planner?gpu=${r.id}`} />
      <p className="mt-2 text-xs text-faint">
        “Fits at 8-bit” is a rough single-device estimate (weights at 8 bits, ~20% of usable memory kept for the KV cache). Dense TFLOPS, no sparsity. Prices are typical cloud on-demand rates. Pick a row to plan on that GPU.
      </p>
    </div>
  );
}
