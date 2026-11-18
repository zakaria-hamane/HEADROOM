"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, Plus, Settings } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/misc";
import { signOut, useSession } from "@/lib/auth-client";
import { cn, initials } from "@/lib/utils";

export function Avatar({ name, image, className }: { name?: string | null; image?: string | null; className?: string }) {
  return (
    <span className={cn("brand-gradient grid size-8 flex-none place-items-center overflow-hidden rounded-full text-[12px] font-bold text-white", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function useSignOut() {
  return async () => {
    await signOut();
    // Full reload: Next.js keeps recent pages mounted, and none of the signed-in ones should survive sign-out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };
}

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const handleSignOut = useSignOut();

  if (isPending) return <Skeleton className="h-9 w-28" />;

  if (!session) {
    return (
      <div className="flex items-center gap-1.5">
        <Link href="/sign-in" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
          Sign in
        </Link>
        <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
          Get started
        </Link>
      </div>
    );
  }

  const { user } = session;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
        <Avatar name={user.name} image={user.image} className="size-9" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-[13px] font-semibold text-fg">{user.name}</span>
          <span className="block truncate text-xs font-medium text-muted">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard /> My plans
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/planner?new=1">
            <Plus /> New plan
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
