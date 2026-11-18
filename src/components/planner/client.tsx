"use client";

import { ClientOnly } from "@/components/client-only";
import { DraftPlanner } from "@/components/planner/draft-planner";
import { Workspace, type WorkspaceProps } from "@/components/planner/workspace";
import { WorkspaceSkeleton } from "@/components/planner/workspace-skeleton";

/** The planner renders in the browser only: it reads drafts from localStorage and runs the engine live. */
export function WorkspaceClient(props: WorkspaceProps) {
  return (
    <ClientOnly fallback={<WorkspaceSkeleton />}>
      <Workspace {...props} />
    </ClientOnly>
  );
}

export function DraftPlannerClient() {
  return (
    <ClientOnly fallback={<WorkspaceSkeleton />}>
      <DraftPlanner />
    </ClientOnly>
  );
}
