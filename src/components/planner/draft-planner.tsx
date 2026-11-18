"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadDraft } from "@/components/planner/draft";
import { Workspace } from "@/components/planner/workspace";
import { GPU_INDEX, MODEL_INDEX } from "@/lib/catalog";
import { defaultState, type PlannerState } from "@/lib/planner/defaults";
import { decodeSetup } from "@/lib/planner/state";
import { TEMPLATES, templateState } from "@/lib/planner/templates";

const INTENT_KEYS = ["template", "code", "new", "model", "gpu", "mode", "save"] as const;

function intentOf(params: URLSearchParams): string {
  return INTENT_KEYS.map((k) => (params.has(k) ? `${k}=${params.get(k)}` : "")).filter(Boolean).join("&");
}

/** Starting point: ?template=, ?code= (setup code), the browser draft, or defaults (?new=1 skips the draft); then ?model=, ?gpu=, ?mode=. */
function initialFrom(params: URLSearchParams): { state: PlannerState; title?: string; openSave: boolean } {
  let state: PlannerState | null = null;
  let title: string | undefined;
  const template = params.get("template");
  if (template) {
    state = templateState(template);
    title = TEMPLATES.find((t) => t.id === template)?.title;
  }
  const code = params.get("code");
  if (!state && code) {
    try {
      state = decodeSetup(code);
    } catch {
      state = null;
    }
  }
  if (!state && params.get("new") !== "1") state = loadDraft();
  if (!state) state = defaultState();
  const model = params.get("model"),
    gpu = params.get("gpu"),
    mode = params.get("mode");
  if (model && MODEL_INDEX[model]) state = { ...state, modelId: model };
  if (gpu && GPU_INDEX[gpu]) state = { ...state, gpuId: gpu };
  if (mode === "ft" || mode === "inf") state = { ...state, mode };
  return { state, title, openSave: params.get("save") === "1" };
}

function DraftPlannerInner() {
  const params = useSearchParams();
  const intent = intentOf(params);
  const [init, setInit] = React.useState(() => ({ ...initialFrom(params), version: 0 }));
  const [lastIntent, setLastIntent] = React.useState(intent);

  // A new ?template= / ?new=1 while this page is already open (query-only navigation): start over from it.
  if (intent !== lastIntent) {
    setLastIntent(intent);
    if (intent) setInit((prev) => ({ ...initialFrom(params), version: prev.version + 1 }));
  }

  React.useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/planner");
  }, [intent]);

  return <Workspace key={init.version} kind="draft" initialState={init.state} title={init.title} openSave={init.openSave} />;
}

/** /planner: an unsaved plan. Keyed by bfcacheId so a fresh visit starts fresh, while Back restores the page as it was. */
export function DraftPlanner() {
  const { bfcacheId } = useRouter();
  return <DraftPlannerInner key={bfcacheId} />;
}
