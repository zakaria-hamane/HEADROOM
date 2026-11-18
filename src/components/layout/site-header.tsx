import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks, NavLinksStatic } from "@/components/layout/nav-links";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";

export function SiteHeader({ className, wide }: { className?: string; wide?: boolean }) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70", className)}>
      <div className={cn("mx-auto flex h-16 items-center gap-5 px-4 sm:px-6", wide ? "max-w-[1480px]" : "max-w-[1240px]")}>
        <Logo />
        <Suspense fallback={<NavLinksStatic className="hidden md:flex" />}>
          <NavLinks className="hidden md:flex" />
        </Suspense>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <UserMenu />
          <MobileNav className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
