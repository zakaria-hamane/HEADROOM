import type { Metadata } from "next";
import { Suspense } from "react";
import { DraftPlannerClient } from "@/components/planner/client";
import { WorkspaceSkeleton } from "@/components/planner/workspace-skeleton";

export const metadata: Metadata = {
  title: "Planner",
  description: "Size GPU memory, speed, GPU count and cost for an LLM and its RAG and agent stack (embedders, rerankers, OCR, speech, guardrails), or a fine-tuning run. No account needed.",
};

export default function PlannerPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <DraftPlannerClient />
    </Suspense>
  );
}
