"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/planner", label: "Planner" },
  { href: "/models", label: "Models" },
  { href: "/gpus", label: "GPUs" },
  { href: "/dashboard", label: "My plans" },
] as const;

const linkClass = "rounded-lg px-3 py-1.5 text-[13.5px] font-semibold text-muted transition-colors hover:bg-panel-3 hover:text-fg";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname.startsWith("/dashboard") || pathname.startsWith("/plans");
  return pathname === href || pathname.startsWith(href + "/");
}

/** Header links with the current section highlighted. Needs a Suspense boundary on dynamic routes. */
export function NavLinks({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("flex items-center gap-1", className)}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(linkClass, active && "bg-panel-3 text-fg")}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Same links without the active state (Suspense fallback). */
export function NavLinksStatic({ className }: { className?: string }) {
  return (
    <nav aria-label="Main" className={cn("flex items-center gap-1", className)}>
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
