import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FreshOnPush } from "@/components/fresh-on-push";
import { WorkspaceClient } from "@/components/planner/client";
import { WorkspaceSkeleton } from "@/components/planner/workspace-skeleton";
import { getOwnedPlan } from "@/lib/plans";
import { sanitizeState } from "@/lib/planner/state";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Plan", robots: { index: false } };

export default function PlanPage({ params }: PageProps<"/plans/[id]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <PlanLoader params={params} />
    </Suspense>
  );
}

async function PlanLoader({ params }: { params: PageProps<"/plans/[id]">["params"] }) {
  const { id } = await params;
  const session = await requireSession(`/plans/${id}`);
  const plan = await getOwnedPlan(id, session.user.id);
  if (!plan) notFound();
  return (
    <FreshOnPush>
      <WorkspaceClient
        kind="owned"
        initialState={sanitizeState(plan.state)}
        plan={{
          id: plan.id,
          name: plan.name,
          description: plan.description,
          isPublic: plan.isPublic,
          shareId: plan.shareId,
          updatedAt: plan.updatedAt.toISOString(),
        }}
      />
    </FreshOnPush>
  );
}
