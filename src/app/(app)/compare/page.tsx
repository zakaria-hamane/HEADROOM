import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ComparePlans } from "@/components/dashboard/compare-plans";
import { getOwnedPlan } from "@/lib/plans";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Compare plans", robots: { index: false } };

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
      <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}>
        <ArrowLeft /> My plans
      </Link>
      <h1 className="mt-3 font-display text-[34px] leading-none font-bold tracking-[0.02em] uppercase">Compare plans</h1>
      <p className="mt-2 mb-6 text-[14px] text-muted">Side by side, computed live from each plan&apos;s current settings.</p>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <CompareContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CompareContent({ searchParams }: { searchParams: PageProps<"/compare">["searchParams"] }) {
  const { ids } = await searchParams;
  const list = [...new Set(String(ids ?? "").split(","))].filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 4);
  const session = await requireSession(`/compare?ids=${list.join(",")}`);
  const plans = (await Promise.all(list.map((id) => getOwnedPlan(id, session.user.id)))).filter((p) => p !== null);
  if (plans.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-line-2 p-10 text-center text-[14px] text-muted">
        Pick at least two of your plans on the{" "}
        <Link href="/dashboard" className="font-semibold text-blue">
          dashboard
        </Link>{" "}
        to compare them.
      </div>
    );
  }
  return <ComparePlans plans={plans.map((p) => ({ id: p.id, name: p.name, state: p.state }))} />;
}
