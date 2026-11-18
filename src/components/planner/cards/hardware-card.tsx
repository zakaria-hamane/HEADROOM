"use client";

import * as React from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { usePlanner } from "@/components/planner/context";
import { Disclosure, NumberField, NumberInput, SpecGrid } from "@/components/planner/inputs";
import { Picker } from "@/components/planner/picker";
import { GPUS, SEGMENT_LABEL } from "@/lib/catalog";
import { NETS, single, type Gpu } from "@/lib/engine";
import { CUSTOM_GPU_FIELDS, GPU_COUNTS } from "@/lib/planner/defaults";
import { nf } from "@/lib/planner/format";
import { gpuSpecs, gpuSub } from "@/lib/planner/specs";
import { currentGpu } from "@/lib/planner/state";

const GPU_FILTERS: [string, string][] = [
  ["all", "All"],
  ["datacenter", "Data center"],
  ["workstation", "Workstation"],
  ["consumer", "Consumer"],
  ["soc", "Apple & SoC"],
  ["other", "TPU / Gaudi"],
];

export function HardwareCard() {
  const { state, gpu, results, set, patch, update, fid } = usePlanner();
  const inf = results.inf,
    ft = results.ft;
  const T = inf ? inf.T : ft!.T;
  const G = inf ? inf.T.G : ft!.G;
  const fitN = inf ? inf.fitN : ft!.fitN;

  const items = React.useMemo<Gpu[]>(
    () => (state.customGpu ? [...GPUS, { ...state.customGpu, id: "custom", vendor: "Custom", segment: "custom" }] : GPUS),
    [state.customGpu],
  );

  const editGpu = (key: keyof Gpu, v: number | null) =>
    update((s) => {
      const src = currentGpu(s);
      const base: Gpu = s.gpuId === "custom" && s.customGpu ? { ...s.customGpu } : { ...src, id: "custom", name: `${src.name} (custom)` };
      (base as unknown as Record<string, unknown>)[key] = v;
      return { ...s, customGpu: base, gpuId: "custom" };
    });

  let hint = "";
  if (state.hw === "single") {
    if (inf) {
      hint = state.autoN
        ? fitN
          ? `Auto picked ${G}: the smallest count that fits`
          : "Needs more than 16 GPUs: try a cluster"
        : fitN
          ? fitN === G
            ? "The smallest count that fits"
            : `Smallest count that fits: ${fitN}`
          : "Does not fit even on 16 GPUs";
    } else if (state.autoN) hint = fitN ? `Auto picked ${G}: the smallest count that fits` : "Needs more than 16 GPUs";
  }

  const counts = single(gpu) ? [1] : [...GPU_COUNTS];

  return (
    <Card>
      <CardTitle step={3}>Hardware</CardTitle>
      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-semibold text-muted">GPU or accelerator</span>
        <Picker<Gpu>
          ariaLabel="GPU"
          items={items}
          value={state.gpuId}
          getKey={(g) => g.id}
          label={(g) => g.name}
          right={(g) => `${nf(g.memGB || 0, 0)} GB`}
          sub={gpuSub}
          group={(g) => `${g.vendor || "Other"} · ${(SEGMENT_LABEL[g.segment || ""] || g.segment || "").toLowerCase()}`}
          text={(g) => [g.name, g.vendor, g.arch, g.id, g.memType].join(" ")}
          filters={GPU_FILTERS}
          filter={(g, f) => {
            if (f === "all" || g.id === "custom") return true;
            if (f === "soc") return g.segment === "apple" || g.segment === "edge" || !!g.unified;
            if (f === "other") return g.segment === "accelerator";
            return g.segment === f;
          }}
          onPick={(g) => set("gpuId", g.id)}
          placeholder="Search GPUs: H100, L40S, 4090, MI300X, M4…"
          buttonLabel={gpu.name}
          buttonSub={gpuSub(gpu)}
        />
      </div>
      <SpecGrid items={gpuSpecs(gpu)} />
      <Disclosure summary="Customize this GPU" defaultOpen={state.gpuId === "custom"}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
          {CUSTOM_GPU_FIELDS.map((f) => (
            <div key={f.key} className="grid min-w-0 content-start gap-1.5">
              <label htmlFor={fid(`cg-${f.key}`)} className="text-xs font-semibold text-muted">
                {f.label}
              </label>
              <NumberInput
                id={fid(`cg-${f.key}`)}
                value={typeof gpu[f.key] === "number" ? (gpu[f.key] as number) : null}
                nullable
                onCommit={(v) => editGpu(f.key, v)}
              />
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-xs text-muted">Editing a value creates a custom GPU, kept with the plan.</p>
      </Disclosure>

      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-semibold text-muted">Setup</span>
        <Segmented<"single" | "cluster">
          label="Setup"
          value={state.hw}
          onChange={(v) => set("hw", v)}
          options={[
            { value: "single", label: "Single server" },
            { value: "cluster", label: "Cluster" },
          ]}
        />
      </div>

      {state.hw === "single" ? (
        <div className="mt-3 grid gap-1.5">
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-xs font-semibold text-muted">Number of GPUs</span>
            <Hint className={fitN ? "" : "text-red"}>{hint}</Hint>
          </div>
          <Segmented<number | "auto">
            label="Number of GPUs"
            value={state.autoN ? "auto" : state.n}
            onChange={(v) => (v === "auto" ? set("autoN", true) : patch({ autoN: false, n: v }))}
            options={[
              { value: "auto", label: "Auto" },
              ...counts.map((n) => ({ value: n, label: String(n), picked: state.autoN && n === G })),
            ]}
          />
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField id={fid("nodes")} label="Nodes" value={state.nodes} integer min={1} onCommit={(v) => v != null && set("nodes", v)} />
            <NumberField id={fid("perNode")} label="GPUs per node" value={state.perNode} integer min={1} onCommit={(v) => v != null && set("perNode", v)} />
            <NumberField id={fid("tp")} label="Tensor parallel (TP)" value={state.tp} integer min={1} onCommit={(v) => v != null && set("tp", v)} />
            <NumberField id={fid("pp")} label="Pipeline parallel (PP)" value={state.pp} integer min={1} onCommit={(v) => v != null && set("pp", v)} />
          </div>
          <div className="mt-3 grid gap-1.5">
            <label htmlFor={fid("net")} className="text-xs font-semibold text-muted">
              Network between nodes
            </label>
            <Select id={fid("net")} value={state.net} onChange={(e) => set("net", e.target.value)}>
              {Object.entries(NETS).map(([k, n]) => (
                <option key={k} value={k}>
                  {n.l}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-2.5 flex flex-wrap gap-1.5 font-mono text-[12.5px] text-muted">
            <span>
              Total <b className="text-fg">{T.G} GPUs</b>
            </span>
            <span>
              · grid <b className="text-fg">{`${T.tp} TP × ${T.pp} PP × ${T.dp} DP`}</b>
            </span>
            {inf ? <span>· {inf.link.kind} inside a TP group</span> : null}
            {T.idle ? <span className="text-red">· {T.idle} idle</span> : null}
          </p>
        </>
      )}
    </Card>
  );
}
