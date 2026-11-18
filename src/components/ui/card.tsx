import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 rounded-2xl border border-line bg-panel p-[18px] shadow-card", className)} {...props} />;
}

/** Section title in the planner's condensed uppercase style, with an optional step badge. */
export function CardTitle({
  step,
  children,
  extra,
  className,
  as: Tag = "h2",
}: {
  step?: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3" | "div";
}) {
  return (
    <Tag className={cn("m-0 flex items-center gap-2.5 font-display text-[15px] font-bold tracking-[0.1em] text-muted uppercase", className)}>
      {step != null ? (
        <span className="primary-gradient grid size-[22px] flex-none place-items-center rounded-[7px] font-sans text-[11px] tracking-normal text-white">
          {step}
        </span>
      ) : null}
      <span className="min-w-0">{children}</span>
      {extra}
    </Tag>
  );
}

export function SectionLabel({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("mt-[18px] mb-2 font-display text-[12px] font-bold tracking-[0.14em] text-muted uppercase", className)} {...props} />;
}
