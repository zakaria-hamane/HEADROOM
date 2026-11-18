"use client";

import * as React from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlanner } from "@/components/planner/context";
import { Disclosure, NumberInput, SpecGrid } from "@/components/planner/inputs";
import { Picker } from "@/components/planner/picker";
import { MODELS } from "@/lib/catalog";
import type { Model } from "@/lib/engine";
import { ARCH_FIELDS } from "@/lib/planner/defaults";
import { fmtP, nf } from "@/lib/planner/format";
import { modelSpecs } from "@/lib/planner/specs";
import { currentModel, getPath } from "@/lib/planner/state";

type PickModel = Model & { _custom?: boolean };

const SIZE_FILTERS: [string, string][] = [
  ["all", "All"],
  ["s", "≤ 10B"],
  ["m", "10–40B"],
  ["l", "40–150B"],
  ["xl", "150B+"],
  ["moe", "MoE"],
];

function sizeOk(m: Model, f: string) {
  const p = m.params || 0;
  return f === "all" || (f === "s" && p <= 10) || (f === "m" && p > 10 && p <= 40) || (f === "l" && p > 40 && p <= 150) || (f === "xl" && p > 150) || (f === "moe" && !!m.moe);
}

export function ModelCard() {
  const { state, model, update, fid } = usePlanner();

  const items = React.useMemo<PickModel[]>(
    () => (state.custom ? [...MODELS, { ...state.custom, id: "custom", family: "Custom", _custom: true }] : MODELS),
    [state.custom],
  );

  const pick = (m: PickModel) =>
    update((s) => {
      const layers = m.layers || 1;
      return { ...s, modelId: m.id, offload: { ...s.offload, layers: Math.min(s.offload.layers, layers) } };
    });

  /** Editing any architecture field turns the current model into a custom copy (as in the original tool). */
  const editArch = (key: string, value: string | number | null) =>
    update((s) => {
      const src = currentModel(s);
      const base: Model =
        s.modelId === "custom" && s.custom ? structuredClone(s.custom) : { ...structuredClone(src), id: "custom", name: `${src.name} (custom)` };
      if (key === "name") base.name = String(value ?? "");
      else {
        const v = value as number | null;
        const parts = key.split(".");
        if (parts.length === 2) {
          const [a, b] = parts as [keyof Model, string];
          const obj = (base[a] as Record<string, unknown> | null | undefined) ?? null;
          if (v === null || v === 0) {
            if (obj) (base as unknown as Record<string, unknown>)[a] = { ...obj, [b]: null };
          } else (base as unknown as Record<string, unknown>)[a] = { ...(obj || {}), [b]: v };
        } else (base as unknown as Record<string, unknown>)[key] = v;
      }
      if (base.moe && !base.moe.experts) base.moe = null;
      if (base.swa && !base.swa.layers) base.swa = null;
      if (base.mla && !base.mla.kvLoraRank) base.mla = null;
      return { ...s, custom: base, modelId: "custom" };
    });

  return (
    <Card>
      <CardTitle step={1}>Model</CardTitle>
      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-semibold text-muted">LLM</span>
        <Picker<PickModel>
          ariaLabel="Model"
          items={items}
          value={state.modelId}
          getKey={(m) => m.id}
          label={(m) => m.name}
          right={(m) => (m.moe ? `${fmtP(m.params)} · ${fmtP(m.activeParams || m.params)} active` : fmtP(m.params || 0))}
          sub={(m) => [m.family, m.org, m.maxCtx ? `${nf(m.maxCtx / 1024, 0)}K context` : "", m.attention, m.released].filter(Boolean).join(" · ")}
          group={(m) => (m.org ? `${m.org} · ` : "") + (m.family || "Other")}
          text={(m) => [m.name, m.family, m.org, m.id].join(" ")}
          filters={SIZE_FILTERS}
          filter={(m, f) => m.id === "custom" || sizeOk(m, f)}
          onPick={pick}
          placeholder={`Search ${MODELS.length} models: name, family, maker…`}
          buttonLabel={model.name}
          buttonSub={[model.family, model.org, model.maxCtx ? `${nf(model.maxCtx / 1024, 0)}K context` : "", model.attention, model.released].filter(Boolean).join(" · ")}
        />
      </div>
      <SpecGrid items={modelSpecs(model)} />
      <Disclosure summary="Customize the architecture">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
          {ARCH_FIELDS.map((f) => {
            const id = fid(`arch-${f.key.replace(".", "-")}`);
            const v = getPath(model, f.key);
            return (
              <div key={f.key} className="grid min-w-0 content-start gap-1.5">
                <label htmlFor={id} className="text-xs font-semibold text-muted">
                  {f.label}
                </label>
                {f.text ? (
                  <Input id={id} value={String(v ?? "")} onChange={(e) => editArch("name", e.target.value)} maxLength={120} />
                ) : (
                  <NumberInput id={id} value={typeof v === "number" ? v : null} nullable onCommit={(x) => editArch(f.key, x)} />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 text-xs text-muted">Editing a value turns this into a custom model, kept with the plan.</p>
      </Disclosure>
    </Card>
  );
}
