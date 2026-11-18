import { CircleCheck, Info, OctagonX, TriangleAlert } from "lucide-react";
import { memoryStatus } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const ICONS = { good: CircleCheck, warning: Info, serious: TriangleAlert, critical: OctagonX } as const;

/** Memory status: icon + label (never color alone). */
export function StatusPill({ ratio, className, size = "md" }: { ratio: number; className?: string; size?: "sm" | "md" }) {
  const st = memoryStatus(ratio);
  const Icon = ICONS[st.level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap text-fg",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
      style={{ borderColor: `color-mix(in srgb, ${st.color} 50%, transparent)`, background: `color-mix(in srgb, ${st.color} 13%, transparent)` }}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} style={{ color: st.color }} aria-hidden />
      {st.label}
    </span>
  );
}
