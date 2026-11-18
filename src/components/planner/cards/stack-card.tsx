"use client";

import * as React from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { usePlanner } from "@/components/planner/context";
import { NumberField, NumberInput } from "@/components/planner/inputs";
import { Picker } from "@/components/planner/picker";
import { COMPANION_INDEX, COMPANIONS } from "@/lib/catalog";
import { CPREC, TASKS, type Companion } from "@/lib/engine";
import { PRESETS, presetStack, STACK_FIELDS, stackItem } from "@/lib/planner/defaults";
import { fmtP, gb, nf } from "@/lib/planner/format";
import { cn } from "@/lib/utils";

const TASK_FILTERS: [string, string][] = [
  ["all", "All"],
  ["embedding", "Embeddings"],
  ["reranker", "Rerankers"],
  ["parser", "Parsing / OCR"],
  ["asr", "Speech-to-text"],
  ["tts", "Text-to-speech"],
  ["guard", "Guardrails"],
  ["more", "Vision, NER, router"],
];

export function TaskTag({ task, api }: { task: string; api?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-[0.06em] whitespace-nowrap uppercase",
        api ? "bg-orange/16 text-orange" : "bg-blue/14 text-blue",
      )}
    >
      {(TASKS[task] || { l: task }).l}
    </span>
  );
}

export function StackCard() {
  const { state, results, set, update, fid } = usePlanner();
  const st = results.inf?.st;

  const addCompanion = (c: Companion) => {
    update((s) => ({ ...s, stack: [...s.stack, stackItem(c)] }));
    toast.success(`Added ${c.name}`);
  };
  const editItem = (i: number, key: string, value: unknown) =>
    update((s) => ({ ...s, stack: s.stack.map((it, j) => (j === i ? { ...it, [key]: value } : it)) }));
  const removeItem = (i: number) => update((s) => ({ ...s, stack: s.stack.filter((_, j) => j !== i) }));

  return (
    <Card>
      <CardTitle
        step="+"
        extra={
          st && st.rows.length ? (
            <span className="ml-auto rounded-full border border-line-2 px-2 py-0.5 font-sans text-[10.5px] font-semibold tracking-[0.04em] text-orange normal-case">
              {st.rows.length} model{st.rows.length > 1 ? "s" : ""} · {gb(st.gpuMem)} on the GPUs
            </span>
          ) : null
        }
      >
        RAG &amp; agent models
      </CardTitle>
      <p className="mt-2.5 text-xs text-muted">
        Embedding, reranking, document parsing, speech and guardrail models that run next to the LLM. Their memory is added to the same GPUs, or to RAM when you put them on the CPU.
      </p>

      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-semibold text-muted">Start from</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                set("stack", presetStack(p.ids));
                toast(p.ids.length ? `Loaded “${p.label}”` : "Removed all companion models");
              }}
              className="rounded-full border border-line-2 px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-blue hover:text-fg"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {state.stack.length === 0 ? <p className="text-xs text-muted">No companion models. Pick a starting stack above or add one below.</p> : null}
        {state.stack.map((it, i) => {
          const c = COMPANION_INDEX[it.id];
          if (!c) return null;
          const api = !!c.api || c.arch === "api";
          const row = st?.rows[i];
          const precs = (c.precisions && c.precisions.length ? c.precisions : ["fp16", "int8", "fp32"]).filter((p) => CPREC[p]);
          if (!precs.includes(it.prec)) precs.unshift(it.prec);
          const fields = (STACK_FIELDS[c.task] || []).filter((f) => !(api && f.key === "par"));
          return (
            <div key={`${it.id}-${i}`} className="grid min-w-0 gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
                <TaskTag task={c.task} api={api} />
                <b className="truncate text-sm">{c.name}</b>
                <span className="ml-auto font-mono text-[12.5px]">
                  {row ? (row.place === "api" ? "cloud API" : row.place === "cpu" ? `${gb(row.ram)} RAM` : gb(row.gpuMem)) : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  aria-label={`Remove ${c.name}`}
                  className="grid size-7 place-items-center rounded-md text-muted hover:bg-panel-3 hover:text-red"
                >
                  <X className="size-4" />
                </button>
              </div>
              {!api || fields.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {!api ? (
                    <>
                      <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-muted">
                        Precision
                        <Select className="h-8 text-[12.5px]" value={it.prec} onChange={(e) => editItem(i, "prec", e.target.value)}>
                          {precs.map((p) => (
                            <option key={p} value={p}>
                              {p.toUpperCase()}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="grid min-w-0 gap-1 text-[11px] font-semibold text-muted">
                        Runs on
                        <Select className="h-8 text-[12.5px]" value={it.place} onChange={(e) => editItem(i, "place", e.target.value)}>
                          <option value="gpu">GPU, with the LLM</option>
                          <option value="cpu">CPU + RAM</option>
                        </Select>
                      </label>
                    </>
                  ) : null}
                  {fields.map((f) => (
                    <label key={f.key} className="grid min-w-0 gap-1 text-[11px] font-semibold text-muted">
                      {f.label}
                      <NumberInput
                        className="h-8 text-[12.5px]"
                        value={typeof it[f.key] === "number" ? (it[f.key] as number) : null}
                        integer
                        onCommit={(v) => v != null && editItem(i, f.key, v)}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              {row && row.metrics.length ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  {row.metrics.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid gap-1.5">
        <span className="text-xs font-semibold text-muted">Add a model</span>
        <Picker<Companion>
          ariaLabel="Add a RAG or agent model"
          items={COMPANIONS}
          value={null}
          getKey={(c) => c.id}
          label={(c) => c.name}
          right={(c) => (c.api || c.arch === "api" ? "cloud API" : c.params ? fmtP(c.params) : c.arch || "")}
          sub={(c) =>
            [c.org, c.maxSeq ? `${nf(c.maxSeq, 0)} tokens` : "", c.dims ? `${c.dims} dims` : "", c.arabic ? "Arabic" : c.multilingual ? "multilingual" : "", c.license]
              .filter(Boolean)
              .join(" · ")
          }
          group={(c) => (TASKS[c.task] || { l: c.task }).l}
          text={(c) =>
            [c.name, c.id, c.org, c.task, (TASKS[c.task] || {}).l, c.arabic ? "arabic" : "", c.french ? "french" : "", c.multilingual ? "multilingual" : "", c.api ? "api cloud" : ""].join(" ")
          }
          filters={TASK_FILTERS}
          filter={(c, f) => f === "all" || c.task === f || (f === "more" && ["vlm", "ner", "router"].includes(c.task))}
          onPick={addCompanion}
          placeholder="Search embeddings, rerankers, parsers, OCR, speech, guardrails…"
          buttonLabel="Add a model…"
          buttonSub={`${COMPANIONS.length} embedding, reranking, parsing, speech and guardrail models`}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField id={fid("qpm")} label="Questions per user per minute" value={state.qpm} onCommit={(v) => v != null && set("qpm", v)} />
        <NumberField id={fid("searchMs")} label="Vector search time (ms)" value={state.searchMs} onCommit={(v) => v != null && set("searchMs", v)} />
        <NumberField id={fid("other")} label="Other GPU memory (GB)" value={state.other} onCommit={(v) => v != null && set("other", v)} />
      </div>
    </Card>
  );
}
