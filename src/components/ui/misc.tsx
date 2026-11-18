import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "blue" | "green" | "amber" | "orange" | "red" | "violet" | "cyan";

const TONES: Record<Tone, string> = {
  neutral: "text-muted border-line-2 bg-panel-3",
  blue: "text-blue border-blue/40 bg-blue/10",
  green: "text-green border-green/40 bg-green/10",
  amber: "text-amber border-amber/40 bg-amber/10",
  orange: "text-orange border-orange/40 bg-orange/10",
  red: "text-red border-red/45 bg-red/10",
  violet: "text-violet border-violet/40 bg-violet/10",
  cyan: "text-cyan border-cyan/45 bg-cyan/10",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] whitespace-nowrap", TONES[tone], className)}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-panel-3", className)} {...props} />;
}

export type MemoryLevel = "good" | "warning" | "serious" | "critical";

/** Memory headroom status (same thresholds as the original tool). Colors are the reserved status tokens. */
export function memoryStatus(ratio: number): { level: MemoryLevel; label: string; tone: Tone; color: string } {
  if (ratio > 1 + 1e-9) return { level: "critical", label: "Out of memory", tone: "red", color: "var(--status-critical)" };
  if (ratio > 0.9) return { level: "serious", label: "Tight", tone: "orange", color: "var(--status-serious)" };
  if (ratio > 0.7) return { level: "warning", label: "Moderate", tone: "amber", color: "var(--status-warning)" };
  return { level: "good", label: "Fits", tone: "green", color: "var(--status-good)" };
}
