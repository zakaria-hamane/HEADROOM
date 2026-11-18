"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme-script";

export type ThemePreference = "light" | "dark" | "system";
type Resolved = "light" | "dark";

// A tiny external store: the <head> script applies the theme before paint; React reads it from the DOM.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}
function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function apply(resolved: Resolved) {
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (readPreference() === "system") {
      apply(mq.matches ? "dark" : "light");
      emit();
    }
  };
  mq.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onSystemChange);
  };
}
const getResolved = (): Resolved => (document.documentElement.classList.contains("dark") ? "dark" : "light");
const getServerResolved = (): Resolved => "light";
const getServerPreference = (): ThemePreference => "system";

export function setThemePreference(p: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* private mode: still switch for this page */
  }
  apply(p === "system" ? (systemDark() ? "dark" : "light") : p);
  emit();
}

export function useTheme(): { preference: ThemePreference; resolved: Resolved; setPreference: (p: ThemePreference) => void } {
  const resolved = React.useSyncExternalStore(subscribe, getResolved, getServerResolved);
  const preference = React.useSyncExternalStore(subscribe, readPreference, getServerPreference);
  return { preference, resolved, setPreference: setThemePreference };
}

/** Kept for API symmetry: the theme needs no provider state, only the head script. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {/* CSS picks the icon from the class the head script set, so it is right from the first paint */}
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-40">
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
