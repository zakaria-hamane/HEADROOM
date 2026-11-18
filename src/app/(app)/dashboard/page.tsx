import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { PlansBrowser } from "@/components/dashboard/plans-browser";
import { TemplateGallery } from "@/components/dashboard/template-gallery";
import { listPlans } from "@/lib/plans";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My plans", robots: { index: false } };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-[34px] leading-none font-bold tracking-[0.02em] uppercase">My plans</h1>
          <Suspense fallback={<Skeleton className="mt-2 h-4 w-48" />}>
            <Greeting />
          </Suspense>
        </div>
        <Link href="/planner?new=1" className={buttonVariants({ variant: "primary", size: "lg" })}>
          <Plus /> New plan
        </Link>
      </div>

      <div className="mt-7">
        <Suspense fallback={<PlansSkeleton />}>
          <Plans />
        </Suspense>
      </div>

      <section className="mt-14" aria-labelledby="templates">
        <h2 id="templates" className="font-display text-xl font-bold tracking-[0.06em] text-muted uppercase">
          Start from a template
        </h2>
        <p className="mt-1 mb-4 text-[13px] text-muted">Common setups with real numbers. Open one, adjust it, save it as your own.</p>
        <TemplateGallery />
      </section>
    </div>
  );
}

async function Greeting() {
  const session = await requireSession("/dashboard");
  const first = session.user.name.split(" ")[0] || "there";
  return <p className="mt-2 text-[14px] text-muted">Hi {first}. Plans autosave as you edit them, and stay private until you share them.</p>;
}

async function Plans() {
  const session = await requireSession("/dashboard");
  const plans = await listPlans(session.user.id);
  return (
    <PlansBrowser
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        mode: p.mode,
        summary: p.summary ?? null,
        starred: p.starred,
        isPublic: p.isPublic,
        shareId: p.shareId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))}
    />
  );
}

function PlansSkeleton() {
  return (
    <div aria-busy="true">
      <div className="flex gap-2.5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
