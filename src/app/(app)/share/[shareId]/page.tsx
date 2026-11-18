import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FreshOnPush } from "@/components/fresh-on-push";
import { WorkspaceClient } from "@/components/planner/client";
import { WorkspaceSkeleton } from "@/components/planner/workspace-skeleton";
import { getSharedPlan } from "@/lib/plans";
import { sanitizeState } from "@/lib/planner/state";

export const metadata: Metadata = {
  title: "Shared plan",
  description: "A read-only GPU plan for an LLM and its RAG and agent stack: memory, speed, GPU count and cost.",
  robots: { index: false },
};

export default function SharedPlanPage({ params }: PageProps<"/share/[shareId]">) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <SharedLoader params={params} />
    </Suspense>
  );
}

async function SharedLoader({ params }: { params: PageProps<"/share/[shareId]">["params"] }) {
  const { shareId } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(shareId)) notFound();
  // A shared plan is read fresh on every request (it can be edited or unshared at any time).
  await connection();
  const plan = await getSharedPlan(shareId);
  if (!plan) notFound();
  return (
    <FreshOnPush>
      <WorkspaceClient
        kind="shared"
        initialState={sanitizeState(plan.state)}
        plan={{ shareId, name: plan.name, description: plan.description, ownerName: plan.ownerName, updatedAt: plan.updatedAt.toISOString() }}
      />
    </FreshOnPush>
  );
}
