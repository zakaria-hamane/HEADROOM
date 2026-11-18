import { Skeleton } from "@/components/ui/misc";

/** Layout-matching placeholder while the planner loads in the browser. */
export function WorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-[1480px] px-4 pb-12 sm:px-6" aria-busy="true" aria-label="Loading the planner">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-5 pb-3">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <Skeleton className="mb-3 h-11 w-64 rounded-[14px]" />
      <div className="grid items-start gap-[18px] min-[1120px]:grid-cols-[minmax(0,1.12fr)_minmax(390px,1fr)]">
        <div className="grid gap-4">
          {[220, 260, 180, 240].map((h, i) => (
            <div key={i} className="rounded-2xl border border-line bg-panel p-[18px] shadow-card" style={{ height: h }}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-4 h-12 w-full" />
              <Skeleton className="mt-3 h-8 w-3/4" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="mt-3 h-12 w-40" />
          <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="mt-5 h-2 w-full rounded-full" />
          <Skeleton className="mt-3 h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
