"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog as D } from "radix-ui";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { useSession } from "@/lib/auth-client";
import { useSignOut } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const { data: session } = useSession();
  const handleSignOut = useSignOut();
  const close = () => setOpen(false);
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Open menu">
          <Menu />
        </Button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgba(8,10,21,.5)] data-[state=open]:animate-fade-in" />
        <D.Content className="fixed inset-x-0 top-0 z-50 rounded-b-2xl border-b border-line-2 bg-panel p-4 pb-5 shadow-pop data-[state=open]:animate-pop-in">
          <div className="flex items-center justify-between">
            <D.Title className="sr-only">Menu</D.Title>
            <D.Description className="sr-only">Site navigation</D.Description>
            <Logo />
            <D.Close className="grid size-9 place-items-center rounded-lg text-muted hover:bg-panel-3" aria-label="Close menu">
              <X className="size-5" />
            </D.Close>
          </div>
          <NavLinks className="mt-4 flex-col items-stretch [&>a]:px-3 [&>a]:py-2.5 [&>a]:text-[15px]" onNavigate={close} />
          <div className="mt-4 grid gap-2 border-t border-line pt-4">
            {session ? (
              <>
                <Link href="/settings" onClick={close} className={buttonVariants({ variant: "secondary", size: "lg" })}>
                  <Settings /> Account settings
                </Link>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    close();
                    void handleSignOut();
                  }}
                >
                  <LogOut /> Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/sign-up" onClick={close} className={buttonVariants({ variant: "primary", size: "lg" })}>
                  Create free account
                </Link>
                <Link href="/sign-in" onClick={close} className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}>
                  Sign in
                </Link>
              </>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
