"use client";

import * as React from "react";
import type { Gpu, Model } from "@/lib/engine";
import { runPlanner, type PlannerResults } from "@/lib/planner/compute";
import type { PlannerState } from "@/lib/planner/defaults";
import { currentGpu, currentModel, setPath } from "@/lib/planner/state";

export interface PlannerContextValue {
  state: PlannerState;
  results: PlannerResults;
  model: Model;
  gpu: Gpu;
  /** Set one value by dotted path ("offload.on"). */
  set: (path: string, value: unknown) => void;
  /** Merge several top-level values. */
  patch: (partial: Partial<PlannerState>) => void;
  /** Functional update for complex edits. */
  update: (fn: (s: PlannerState) => PlannerState) => void;
  replace: (s: PlannerState) => void;
  /**
   * Element id unique to this workspace instance. Next.js keeps recently visited pages mounted (hidden), so two
   * planners can be in the document at once: fixed ids would make labels point at the hidden copy.
   */
  fid: (name: string) => string;
  resultsRef: React.RefObject<HTMLDivElement | null>;
}

const PlannerContext = React.createContext<PlannerContextValue | null>(null);

export function PlannerProvider({
  state,
  onStateChange,
  children,
}: {
  state: PlannerState;
  onStateChange: React.Dispatch<React.SetStateAction<PlannerState>>;
  children: React.ReactNode;
}) {
  const prefix = React.useId();
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const results = React.useMemo(() => runPlanner(state), [state]);
  const value = React.useMemo<PlannerContextValue>(
    () => ({
      state,
      results,
      model: currentModel(state),
      gpu: currentGpu(state),
      set: (path, v) => onStateChange((s) => setPath(s, path, v)),
      patch: (partial) => onStateChange((s) => ({ ...s, ...partial })),
      update: (fn) => onStateChange(fn),
      replace: (s) => onStateChange(s),
      fid: (name) => `${prefix}${name}`,
      resultsRef,
    }),
    [state, results, onStateChange, prefix],
  );
  return <PlannerContext value={value}>{children}</PlannerContext>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = React.use(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used inside PlannerProvider");
  return ctx;
}
