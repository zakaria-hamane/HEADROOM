import { Skeleton } from "@/components/ui/misc";

export function AuthFormSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-4 h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
