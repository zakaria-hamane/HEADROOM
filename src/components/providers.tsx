"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-center"
      closeButton
      toastOptions={{ classNames: { toast: "!rounded-xl !border-line-2 !font-sans !text-[13px] !shadow-pop" } }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
      <ThemedToaster />
    </ThemeProvider>
  );
}
